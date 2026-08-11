create or replace function private.update_trip_details(
  requested_trip_id uuid,
  trip_name text,
  trip_starts_on date,
  trip_ends_on date,
  trip_home_currency text,
  trip_default_time_zone text
)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_trip public.trips;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not private.can_edit_trip(requested_trip_id) then raise exception 'Only owners and editors can edit this trip'; end if;
  if char_length(trim(trip_name)) not between 1 and 120 then raise exception 'Trip name is required'; end if;
  if trip_ends_on < trip_starts_on then raise exception 'Trip end date must not precede its start date'; end if;
  if upper(trip_home_currency) !~ '^[A-Z]{3}$' then raise exception 'Home currency must be a three-letter ISO code'; end if;
  if char_length(trim(trip_default_time_zone)) not between 1 and 80 then raise exception 'Time zone is required'; end if;

  update public.trips
  set
    name = trim(trip_name),
    starts_on = trip_starts_on,
    ends_on = trip_ends_on,
    home_currency = upper(trip_home_currency),
    default_time_zone = trim(trip_default_time_zone),
    updated_at = now()
  where id = requested_trip_id
  returning * into updated_trip;

  if updated_trip.id is null then raise exception 'Trip not found'; end if;
  return updated_trip;
end;
$$;

create or replace function private.manage_trip_member(
  requested_trip_id uuid,
  target_user_id uuid,
  requested_role public.trip_role,
  remove_member boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  target_current_role public.trip_role;
begin
  if actor_user_id is null then raise exception 'Authentication required'; end if;
  if not private.is_trip_owner(requested_trip_id) then raise exception 'Only trip owners can manage travellers'; end if;
  if actor_user_id = target_user_id then raise exception 'Ask another owner to change your own membership'; end if;

  select role into target_current_role
  from public.trip_members
  where trip_id = requested_trip_id and user_id = target_user_id
  for update;

  if target_current_role is null then raise exception 'Traveller is not a member of this trip'; end if;

  if remove_member then
    if exists (
      select 1
      from (
        select distinct e.currency
        from public.expenses e
        join public.expense_payers ep on ep.expense_id = e.id
        where e.trip_id = requested_trip_id and ep.user_id = target_user_id
        union
        select distinct e.currency
        from public.expenses e
        join public.expense_allocation_groups eag on eag.expense_id = e.id
        join public.expense_shares es on es.allocation_group_id = eag.id
        where e.trip_id = requested_trip_id and es.user_id = target_user_id
        union
        select distinct s.currency
        from public.settlements s
        where s.trip_id = requested_trip_id
          and (s.from_user_id = target_user_id or s.to_user_id = target_user_id)
      ) currencies
      where private.member_currency_balance(requested_trip_id, target_user_id, currencies.currency) <> 0
    ) then
      raise exception 'Settle this traveller''s outstanding balance before removing them';
    end if;

    delete from public.segment_members sm
    using public.segments s
    where sm.segment_id = s.id
      and s.trip_id = requested_trip_id
      and sm.user_id = target_user_id;

    delete from public.item_participants ip
    using public.itinerary_items item
    where ip.item_id = item.id
      and item.trip_id = requested_trip_id
      and ip.user_id = target_user_id;

    delete from public.trip_members
    where trip_id = requested_trip_id and user_id = target_user_id;
  else
    if requested_role is null then raise exception 'Role is required'; end if;
    update public.trip_members
    set role = requested_role
    where trip_id = requested_trip_id and user_id = target_user_id;
  end if;
end;
$$;

create or replace function public.update_trip_details(
  requested_trip_id uuid,
  trip_name text,
  trip_starts_on date,
  trip_ends_on date,
  trip_home_currency text,
  trip_default_time_zone text
)
returns public.trips
language sql
security invoker
set search_path = ''
as $$
  select private.update_trip_details(
    requested_trip_id,
    trip_name,
    trip_starts_on,
    trip_ends_on,
    trip_home_currency,
    trip_default_time_zone
  );
$$;

create or replace function public.manage_trip_member(
  requested_trip_id uuid,
  target_user_id uuid,
  requested_role public.trip_role,
  remove_member boolean default false
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.manage_trip_member(
    requested_trip_id,
    target_user_id,
    requested_role,
    remove_member
  );
$$;

revoke update, delete on public.trip_members from authenticated;

revoke all on function private.update_trip_details(uuid, text, date, date, text, text) from public, anon;
revoke all on function private.manage_trip_member(uuid, uuid, public.trip_role, boolean) from public, anon;
grant execute on function private.update_trip_details(uuid, text, date, date, text, text) to authenticated;
grant execute on function private.manage_trip_member(uuid, uuid, public.trip_role, boolean) to authenticated;

revoke all on function public.update_trip_details(uuid, text, date, date, text, text) from public, anon;
revoke all on function public.manage_trip_member(uuid, uuid, public.trip_role, boolean) from public, anon;
grant execute on function public.update_trip_details(uuid, text, date, date, text, text) to authenticated;
grant execute on function public.manage_trip_member(uuid, uuid, public.trip_role, boolean) to authenticated;
