create or replace function private.update_itinerary_item(
  requested_item_id uuid,
  item_title text,
  item_starts_at timestamptz,
  item_ends_at timestamptz,
  item_location_label text
)
returns public.itinerary_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_item public.itinerary_items;
  linked_stay public.itinerary_items;
  updated_item public.itinerary_items;
  normalized_location text := nullif(trim(item_location_label), '');
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;

  select * into existing_item
  from public.itinerary_items
  where id = requested_item_id
  for update;

  if existing_item.id is null then raise exception 'Itinerary item not found'; end if;
  if not private.can_edit_trip(existing_item.trip_id) then raise exception 'Only owners and editors can edit this plan'; end if;
  if char_length(trim(item_title)) not between 1 and 180 then raise exception 'Plan title is required'; end if;
  if item_ends_at is null or item_ends_at <= item_starts_at then raise exception 'End time must be later than start time'; end if;

  if existing_item.kind = 'lodging' and normalized_location is null then
    raise exception 'Hotel location is required';
  end if;

  if existing_item.linked_stay_id is not null then
    select * into linked_stay from public.itinerary_items where id = existing_item.linked_stay_id;
    if linked_stay.id is null or linked_stay.kind <> 'lodging' then raise exception 'Linked stay not found'; end if;
    if item_ends_at <> linked_stay.starts_at then raise exception 'Hotel transfer arrival follows check-in time'; end if;
    if normalized_location is distinct from linked_stay.location_label then raise exception 'Hotel transfer destination follows the saved hotel'; end if;
  end if;

  update public.itinerary_items
  set
    title = trim(item_title),
    starts_at = item_starts_at,
    ends_at = item_ends_at,
    location_label = normalized_location,
    updated_at = now(),
    version = version + 1
  where id = requested_item_id
  returning * into updated_item;

  if existing_item.kind = 'lodging' then
    delete from public.itinerary_items where linked_stay_id = requested_item_id;
  end if;

  return updated_item;
end;
$$;

create or replace function private.delete_itinerary_item(requested_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_item public.itinerary_items;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into existing_item from public.itinerary_items where id = requested_item_id for update;
  if existing_item.id is null then raise exception 'Itinerary item not found'; end if;
  if not private.can_edit_trip(existing_item.trip_id) then raise exception 'Only owners and editors can delete this plan'; end if;
  delete from public.itinerary_items where id = requested_item_id;
end;
$$;

create or replace function private.delete_trip(requested_trip_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  trip_creator uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select created_by into trip_creator from public.trips where id = requested_trip_id for update;
  if trip_creator is null then raise exception 'Trip not found'; end if;
  if trip_creator <> (select auth.uid()) then raise exception 'Only the trip creator can permanently delete this trip'; end if;
  delete from public.trips where id = requested_trip_id;
end;
$$;

create or replace function public.update_itinerary_item(
  requested_item_id uuid,
  item_title text,
  item_starts_at timestamptz,
  item_ends_at timestamptz,
  item_location_label text
)
returns public.itinerary_items
language sql
security invoker
set search_path = ''
as $$
  select private.update_itinerary_item(requested_item_id, item_title, item_starts_at, item_ends_at, item_location_label);
$$;

create or replace function public.delete_itinerary_item(requested_item_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.delete_itinerary_item(requested_item_id);
$$;

create or replace function public.delete_trip(requested_trip_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.delete_trip(requested_trip_id);
$$;

revoke update, delete on public.itinerary_items from authenticated;
revoke delete on public.trips from authenticated;

revoke all on function private.update_itinerary_item(uuid, text, timestamptz, timestamptz, text) from public, anon;
revoke all on function private.delete_itinerary_item(uuid) from public, anon;
revoke all on function private.delete_trip(uuid) from public, anon;
grant execute on function private.update_itinerary_item(uuid, text, timestamptz, timestamptz, text) to authenticated;
grant execute on function private.delete_itinerary_item(uuid) to authenticated;
grant execute on function private.delete_trip(uuid) to authenticated;

revoke all on function public.update_itinerary_item(uuid, text, timestamptz, timestamptz, text) from public, anon;
revoke all on function public.delete_itinerary_item(uuid) from public, anon;
revoke all on function public.delete_trip(uuid) from public, anon;
grant execute on function public.update_itinerary_item(uuid, text, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.delete_itinerary_item(uuid) to authenticated;
grant execute on function public.delete_trip(uuid) to authenticated;
