drop policy if exists itinerary_insert_editors on public.itinerary_items;
create policy itinerary_insert_editors on public.itinerary_items for insert to authenticated
with check (
  public.can_edit_trip(trip_id)
  and created_by = (select auth.uid())
  and linked_stay_id is null
);

drop policy if exists itinerary_update_editors on public.itinerary_items;
create policy itinerary_update_editors on public.itinerary_items for update to authenticated
using (public.can_edit_trip(trip_id))
with check (public.can_edit_trip(trip_id) and linked_stay_id is null);

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
  if source_item.id is null or source_item.trip_id <> stay.trip_id or source_item.id = stay.id then
    raise exception 'Previous place is invalid';
  end if;
  if source_item.location_label is null or char_length(trim(source_item.location_label)) = 0 then
    raise exception 'Previous place needs a location';
  end if;
  if coalesce(source_item.ends_at, source_item.starts_at) >= stay.starts_at then
    raise exception 'Previous place must end before check-in';
  end if;

  departure_at := case
    when stay.starts_at - coalesce(source_item.ends_at, source_item.starts_at) <= interval '4 hours'
      then coalesce(source_item.ends_at, source_item.starts_at)
    else stay.starts_at - interval '90 minutes'
  end;

  insert into public.itinerary_items (
    trip_id, created_by, kind, title, starts_at, ends_at, location_label, linked_stay_id
  ) values (
    stay.trip_id, actor_user_id, 'transport', trim(route_title), departure_at, stay.starts_at,
    stay.location_label, stay.id
  )
  on conflict (linked_stay_id) where linked_stay_id is not null
  do update set updated_at = public.itinerary_items.updated_at
  returning id into transfer_id;

  return transfer_id;
end;
$$;

grant execute on function private.create_stay_transfer(uuid, uuid, text) to authenticated;

alter table public.itinerary_items validate constraint lodging_requires_checkout_and_location;
