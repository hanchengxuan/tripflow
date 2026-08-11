alter table public.itinerary_items
  add column linked_stay_id uuid references public.itinerary_items(id) on delete cascade;

alter table public.itinerary_items
  add constraint itinerary_linked_stay_transport_only
  check (linked_stay_id is null or kind = 'transport');

alter table public.itinerary_items
  add constraint lodging_requires_checkout_and_location
  check (
    kind <> 'lodging'
    or (
      ends_at is not null
      and ends_at > starts_at
      and location_label is not null
      and char_length(trim(location_label)) > 0
    )
  ) not valid;

create unique index itinerary_one_transfer_per_stay_idx
  on public.itinerary_items (linked_stay_id)
  where linked_stay_id is not null;

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
  if coalesce(source_item.ends_at, source_item.starts_at) > stay.starts_at then
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

create or replace function public.create_stay_transfer(
  requested_stay_id uuid,
  source_item_id uuid,
  route_title text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.create_stay_transfer(requested_stay_id, source_item_id, route_title);
$$;

revoke all on function private.create_stay_transfer(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.create_stay_transfer(uuid, uuid, text) from public, anon;
grant execute on function public.create_stay_transfer(uuid, uuid, text) to authenticated;
