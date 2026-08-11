-- Remote migration version: 20260811070802
create table public.trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  token_digest text not null unique,
  role public.trip_role not null default 'editor' check (role in ('editor', 'viewer')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  max_uses integer not null default 8 check (max_uses between 1 and 32),
  use_count integer not null default 0 check (use_count between 0 and max_uses),
  revoked_at timestamptz
);

create index trip_invites_trip_created_idx on public.trip_invites (trip_id, created_at desc);

alter table public.trip_invites enable row level security;
revoke all privileges on public.trip_invites from anon;
grant select, insert, update, delete on public.trip_invites to authenticated;

create policy trip_invites_read_owners on public.trip_invites for select to authenticated
using (public.is_trip_owner(trip_id));
create policy trip_invites_insert_owners on public.trip_invites for insert to authenticated
with check (public.is_trip_owner(trip_id) and created_by = (select auth.uid()));
create policy trip_invites_update_owners on public.trip_invites for update to authenticated
using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));
create policy trip_invites_delete_owners on public.trip_invites for delete to authenticated
using (public.is_trip_owner(trip_id));

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
        nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
        'Traveler'
      ),
      80
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

insert into public.profiles (id, display_name)
select
  id,
  left(
    coalesce(
      nullif(trim(raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(email, ''), '@', 1), ''),
      'Traveler'
    ),
    80
  )
from auth.users
on conflict (id) do nothing;

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

create or replace function public.create_trip_invite(
  requested_trip_id uuid,
  invited_role public.trip_role default 'editor',
  valid_for_hours integer default 168,
  allowed_uses integer default 8
)
returns table (invite_token text, invite_expires_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  raw_token text := encode(gen_random_bytes(24), 'hex');
  expiry timestamptz := now() + make_interval(hours => valid_for_hours);
begin
  if not public.is_trip_owner(requested_trip_id) then raise exception 'Only a trip owner can create invites'; end if;
  if invited_role not in ('editor', 'viewer') then raise exception 'Invite role must be editor or viewer'; end if;
  if valid_for_hours not between 1 and 720 then raise exception 'Invite validity must be between 1 and 720 hours'; end if;
  if allowed_uses not between 1 and 32 then raise exception 'Invite uses must be between 1 and 32'; end if;

  insert into public.trip_invites (
    trip_id, token_digest, role, created_by, expires_at, max_uses
  ) values (
    requested_trip_id,
    encode(digest(raw_token, 'sha256'), 'hex'),
    invited_role,
    (select auth.uid()),
    expiry,
    allowed_uses
  );

  return query select raw_token, expiry;
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
  if char_length(trim(invite_token)) <> 48 then raise exception 'Invite code is invalid'; end if;

  select * into matched_invite
  from public.trip_invites
  where token_digest = encode(digest(trim(invite_token), 'sha256'), 'hex')
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

revoke all on function private.accept_trip_invite(text) from public, anon;
grant execute on function private.accept_trip_invite(text) to authenticated;

create or replace function public.accept_trip_invite(invite_token text)
returns uuid
language sql
security invoker
set search_path = ''
as $$ select private.accept_trip_invite(invite_token); $$;

create or replace function public.create_equal_expense(
  requested_trip_id uuid,
  expense_title text,
  expense_currency text,
  expense_total_minor bigint,
  payer_user_id uuid,
  participant_user_ids uuid[],
  expense_occurred_at timestamptz default now(),
  requested_segment_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  created_expense_id uuid := gen_random_uuid();
  allocation_group_id uuid := gen_random_uuid();
  participant_count integer := cardinality(participant_user_ids);
  base_share bigint;
  remainder bigint;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if not public.is_trip_member(requested_trip_id) then raise exception 'Trip membership required'; end if;
  if char_length(trim(expense_title)) not between 1 and 180 then raise exception 'Expense title is required'; end if;
  if upper(expense_currency) !~ '^[A-Z]{3}$' then raise exception 'Currency must be a three-letter ISO code'; end if;
  if expense_total_minor <= 0 then raise exception 'Expense total must be positive'; end if;
  if participant_count is null or participant_count = 0 then raise exception 'At least one participant is required'; end if;
  if participant_count <> (
    select count(distinct participant.user_id)
    from unnest(participant_user_ids) as participant(user_id)
  ) then
    raise exception 'Participants must be unique';
  end if;
  if not public.is_user_trip_member(requested_trip_id, payer_user_id) then raise exception 'Payer must be a trip member'; end if;
  if exists (
    select 1 from unnest(participant_user_ids) as participant(user_id)
    where not public.is_user_trip_member(requested_trip_id, participant.user_id)
  ) then raise exception 'Every participant must be a trip member'; end if;
  if requested_segment_id is not null and not public.can_read_segment(requested_segment_id) then
    raise exception 'Segment access required';
  end if;

  insert into public.expenses (
    id, trip_id, segment_id, created_by, title, currency, total_minor, occurred_at, source
  ) values (
    created_expense_id,
    requested_trip_id,
    requested_segment_id,
    current_user_id,
    trim(expense_title),
    upper(expense_currency),
    expense_total_minor,
    expense_occurred_at,
    'manual'
  );

  insert into public.expense_payers (expense_id, user_id, amount_minor)
  values (created_expense_id, payer_user_id, expense_total_minor);

  insert into public.expense_allocation_groups (id, expense_id, label, amount_minor)
  values (allocation_group_id, created_expense_id, 'Equal split', expense_total_minor);

  base_share := expense_total_minor / participant_count;
  remainder := expense_total_minor % participant_count;

  insert into public.expense_shares (allocation_group_id, user_id, amount_minor)
  select
    allocation_group_id,
    participant_id,
    base_share + case when position <= remainder then 1 else 0 end
  from unnest(participant_user_ids) with ordinality as participants(participant_id, position);

  return created_expense_id;
end;
$$;

revoke all on function public.create_trip(text, date, date, text, text) from public, anon;
revoke all on function public.create_trip_invite(uuid, public.trip_role, integer, integer) from public, anon;
revoke all on function public.accept_trip_invite(text) from public, anon;
revoke all on function public.create_equal_expense(uuid, text, text, bigint, uuid, uuid[], timestamptz, uuid) from public, anon;
grant execute on function public.create_trip(text, date, date, text, text) to authenticated;
grant execute on function public.create_trip_invite(uuid, public.trip_role, integer, integer) to authenticated;
grant execute on function public.accept_trip_invite(text) to authenticated;
grant execute on function public.create_equal_expense(uuid, text, text, bigint, uuid, uuid[], timestamptz, uuid) to authenticated;
