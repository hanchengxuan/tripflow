alter table public.profiles
  add column deleted_at timestamptz;

alter table public.profiles
  drop constraint profiles_id_fkey;

create or replace function private.is_active_user(requested_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = requested_user_id and deleted_at is null
  );
$$;

revoke all on function private.is_active_user(uuid) from public, anon, authenticated;
grant execute on function private.is_active_user(uuid) to authenticated;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$ select private.is_active_user((select auth.uid())); $$;

revoke all on function public.is_active_user() from public, anon;
grant execute on function public.is_active_user() to authenticated;

revoke insert on public.profiles from authenticated;
drop policy profiles_insert_self on public.profiles;

drop policy profiles_update_self on public.profiles;
create policy profiles_update_active_self on public.profiles for update to authenticated
using (id = (select auth.uid()) and deleted_at is null)
with check (id = (select auth.uid()) and deleted_at is null);

drop policy trips_create_self on public.trips;
create policy trips_create_active_self on public.trips for insert to authenticated
with check (created_by = (select auth.uid()) and public.is_active_user());

drop policy expenses_update_creator_or_editors on public.expenses;
create policy expenses_update_active_creator_or_editors on public.expenses for update to authenticated
using (public.is_active_user() and (created_by = (select auth.uid()) or public.can_edit_trip(trip_id)))
with check (public.is_active_user() and (created_by = (select auth.uid()) or public.can_edit_trip(trip_id)));

drop policy expense_payers_write_authorized on public.expense_payers;
create policy expense_payers_write_active_authorized on public.expense_payers for all to authenticated
using (
  public.is_active_user() and exists (
    select 1 from public.expenses e
    where e.id = expense_id
      and (e.created_by = (select auth.uid()) or public.can_edit_trip(e.trip_id))
  )
)
with check (
  public.is_active_user() and exists (
    select 1 from public.expenses e
    where e.id = expense_id
      and (e.created_by = (select auth.uid()) or public.can_edit_trip(e.trip_id))
  )
);

drop policy allocation_groups_write_authorized on public.expense_allocation_groups;
create policy allocation_groups_write_active_authorized on public.expense_allocation_groups for all to authenticated
using (
  public.is_active_user() and exists (
    select 1 from public.expenses e
    where e.id = expense_id
      and (e.created_by = (select auth.uid()) or public.can_edit_trip(e.trip_id))
  )
)
with check (
  public.is_active_user() and exists (
    select 1 from public.expenses e
    where e.id = expense_id
      and (e.created_by = (select auth.uid()) or public.can_edit_trip(e.trip_id))
  )
);

drop policy expense_shares_write_authorized on public.expense_shares;
create policy expense_shares_write_active_authorized on public.expense_shares for all to authenticated
using (
  public.is_active_user() and exists (
    select 1
    from public.expense_allocation_groups g
    join public.expenses e on e.id = g.expense_id
    where g.id = allocation_group_id
      and (e.created_by = (select auth.uid()) or public.can_edit_trip(e.trip_id))
  )
)
with check (
  public.is_active_user() and exists (
    select 1
    from public.expense_allocation_groups g
    join public.expenses e on e.id = g.expense_id
    where g.id = allocation_group_id
      and (e.created_by = (select auth.uid()) or public.can_edit_trip(e.trip_id))
  )
);

create or replace function public.create_trip(
  trip_name text,
  trip_starts_on date,
  trip_ends_on date,
  trip_home_currency text,
  trip_default_time_zone text
)
returns public.trips
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  created_trip public.trips;
  created_trip_id uuid := gen_random_uuid();
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if not public.is_active_user() then raise exception 'Account is deleted'; end if;
  if char_length(trim(trip_name)) not between 1 and 120 then raise exception 'Trip name is required'; end if;
  if trip_ends_on < trip_starts_on then raise exception 'Trip end date must not precede its start date'; end if;
  if upper(trip_home_currency) !~ '^[A-Z]{3}$' then raise exception 'Home currency must be a three-letter ISO code'; end if;
  if char_length(trim(trip_default_time_zone)) = 0 then raise exception 'Time zone is required'; end if;

  insert into public.trips (
    id, created_by, name, starts_on, ends_on, home_currency, default_time_zone
  ) values (
    created_trip_id,
    current_user_id,
    trim(trip_name),
    trip_starts_on,
    trip_ends_on,
    upper(trip_home_currency),
    trim(trip_default_time_zone)
  );

  insert into public.trip_members (trip_id, user_id, role)
  values (created_trip_id, current_user_id, 'owner');

  select * into created_trip from public.trips where id = created_trip_id;
  return created_trip;
end;
$$;

create or replace function private.accept_trip_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  matched_invite public.trip_invites;
  inserted_count integer;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if not private.is_active_user(current_user_id) then raise exception 'Account is deleted'; end if;
  if char_length(trim(invite_token)) <> 48 then raise exception 'Invite code is invalid'; end if;

  select * into matched_invite
  from public.trip_invites
  where token_digest = encode(extensions.digest(trim(invite_token), 'sha256'), 'hex')
    and revoked_at is null
    and expires_at > now()
    and use_count < max_uses
  for update;

  if matched_invite.id is null then raise exception 'Invite code is invalid or expired'; end if;

  insert into public.trip_members (trip_id, user_id, role)
  values (matched_invite.trip_id, current_user_id, matched_invite.role)
  on conflict (trip_id, user_id) do nothing;
  get diagnostics inserted_count = row_count;

  if inserted_count = 1 then
    update public.trip_invites set use_count = use_count + 1 where id = matched_invite.id;
  end if;

  return matched_invite.trip_id;
end;
$$;

create or replace function private.delete_current_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  owned_trip record;
  successor_id uuid;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if not private.is_active_user(current_user_id) then raise exception 'Account is already deleted'; end if;

  for owned_trip in
    select id from public.trips where created_by = current_user_id for update
  loop
    select tm.user_id into successor_id
    from public.trip_members tm
    where tm.trip_id = owned_trip.id and tm.user_id <> current_user_id
    order by
      case tm.role when 'owner' then 0 when 'editor' then 1 else 2 end,
      tm.joined_at,
      tm.user_id
    limit 1;

    if successor_id is null then
      delete from public.trips where id = owned_trip.id;
    else
      update public.trip_members
      set role = 'owner'
      where trip_id = owned_trip.id and user_id = successor_id;

      update public.trips
      set created_by = successor_id, updated_at = now()
      where id = owned_trip.id;
    end if;
  end loop;

  delete from public.segment_members where user_id = current_user_id;
  delete from public.trip_members where user_id = current_user_id;

  update public.profiles
  set display_name = '已注销用户', deleted_at = now(), updated_at = now()
  where id = current_user_id;

  delete from auth.users where id = current_user_id;
end;
$$;

revoke all on function private.delete_current_account() from public, anon, authenticated;
grant execute on function private.delete_current_account() to authenticated;

create or replace function public.delete_current_account()
returns void
language sql
security invoker
set search_path = ''
as $$ select private.delete_current_account(); $$;

revoke all on function public.delete_current_account() from public, anon;
grant execute on function public.delete_current_account() to authenticated;
