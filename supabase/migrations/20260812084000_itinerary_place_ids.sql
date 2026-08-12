alter table public.itinerary_items
  add column google_place_id text;

alter table public.itinerary_items
  add constraint itinerary_google_place_id_length
  check (google_place_id is null or char_length(google_place_id) between 10 and 300);

drop function public.update_itinerary_item(uuid, text, timestamptz, timestamptz, text);
drop function private.update_itinerary_item(uuid, text, timestamptz, timestamptz, text);

create or replace function private.update_itinerary_item(
  requested_item_id uuid,
  item_title text,
  item_starts_at timestamptz,
  item_ends_at timestamptz,
  item_location_label text,
  item_google_place_id text
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
  normalized_place_id text := nullif(trim(item_google_place_id), '');
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;

  select * into existing_item from public.itinerary_items where id = requested_item_id for update;
  if existing_item.id is null then raise exception 'Itinerary item not found'; end if;
  if not private.can_edit_trip(existing_item.trip_id) then raise exception 'Only owners and editors can edit this plan'; end if;
  if char_length(trim(item_title)) not between 1 and 180 then raise exception 'Plan title is required'; end if;
  if item_ends_at is null or item_ends_at <= item_starts_at then raise exception 'End time must be later than start time'; end if;
  if normalized_place_id is not null and char_length(normalized_place_id) not between 10 and 300 then raise exception 'Place ID is invalid'; end if;
  if existing_item.kind = 'lodging' and normalized_location is null then raise exception 'Hotel location is required'; end if;

  if existing_item.linked_stay_id is not null then
    select * into linked_stay from public.itinerary_items where id = existing_item.linked_stay_id;
    if linked_stay.id is null or linked_stay.kind <> 'lodging' then raise exception 'Linked stay not found'; end if;
    if item_ends_at <> linked_stay.starts_at then raise exception 'Hotel transfer arrival follows check-in time'; end if;
    if normalized_location is distinct from linked_stay.location_label then raise exception 'Hotel transfer destination follows the saved hotel'; end if;
    if normalized_place_id is distinct from linked_stay.google_place_id then raise exception 'Hotel transfer place follows the saved hotel'; end if;
  end if;

  update public.itinerary_items
  set title = trim(item_title), starts_at = item_starts_at, ends_at = item_ends_at,
      location_label = normalized_location, google_place_id = normalized_place_id,
      updated_at = now(), version = version + 1
  where id = requested_item_id
  returning * into updated_item;

  if existing_item.kind = 'lodging' then
    delete from public.itinerary_items where linked_stay_id = requested_item_id;
  end if;
  return updated_item;
end;
$$;

create or replace function public.update_itinerary_item(
  requested_item_id uuid,
  item_title text,
  item_starts_at timestamptz,
  item_ends_at timestamptz,
  item_location_label text,
  item_google_place_id text
)
returns public.itinerary_items
language sql
security invoker
set search_path = ''
as $$
  select private.update_itinerary_item(requested_item_id, item_title, item_starts_at, item_ends_at, item_location_label, item_google_place_id);
$$;

revoke all on function private.update_itinerary_item(uuid, text, timestamptz, timestamptz, text, text) from public, anon;
grant execute on function private.update_itinerary_item(uuid, text, timestamptz, timestamptz, text, text) to authenticated;
revoke all on function public.update_itinerary_item(uuid, text, timestamptz, timestamptz, text, text) from public, anon;
grant execute on function public.update_itinerary_item(uuid, text, timestamptz, timestamptz, text, text) to authenticated;

create or replace function private.create_stay_transfer(
  requested_stay_id uuid,
  source_item_id uuid,
  route_title text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  stay public.itinerary_items;
  source_item public.itinerary_items;
  departure_at timestamptz;
  transfer_id uuid;
begin
  if actor_user_id is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(requested_stay_id::text, 0));
  select * into stay from public.itinerary_items where id = requested_stay_id for update;
  if stay.id is null or stay.kind <> 'lodging' then raise exception 'Stay not found'; end if;
  if not private.can_edit_trip(stay.trip_id) then raise exception 'Only owners and editors can add a transfer'; end if;
  if stay.location_label is null or char_length(trim(stay.location_label)) = 0 then raise exception 'Add the hotel location first'; end if;
  select * into source_item from public.itinerary_items where id = source_item_id;
  if source_item.id is null or source_item.trip_id <> stay.trip_id or source_item.id = stay.id then raise exception 'Previous place is invalid'; end if;
  if source_item.location_label is null or char_length(trim(source_item.location_label)) = 0 then raise exception 'Previous place needs a location'; end if;
  if coalesce(source_item.ends_at, source_item.starts_at) >= stay.starts_at then raise exception 'Previous place must end before check-in'; end if;

  departure_at := case
    when stay.starts_at - coalesce(source_item.ends_at, source_item.starts_at) <= interval '4 hours' then coalesce(source_item.ends_at, source_item.starts_at)
    else stay.starts_at - interval '90 minutes'
  end;

  insert into public.itinerary_items (
    trip_id, created_by, kind, title, starts_at, ends_at, location_label, google_place_id, linked_stay_id
  ) values (
    stay.trip_id, actor_user_id, 'transport', trim(route_title), departure_at, stay.starts_at,
    stay.location_label, stay.google_place_id, stay.id
  )
  on conflict (linked_stay_id) where linked_stay_id is not null
  do update set updated_at = public.itinerary_items.updated_at
  returning id into transfer_id;
  return transfer_id;
end;
$$;
