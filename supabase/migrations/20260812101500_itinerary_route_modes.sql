alter table public.itinerary_items
  add column route_travel_mode text not null default 'DRIVE';

alter table public.itinerary_items
  add constraint itinerary_route_travel_mode_allowed
  check (route_travel_mode in ('DRIVE', 'TRANSIT', 'WALK', 'BICYCLE'));

create or replace function private.update_itinerary_route_mode(
  requested_item_id uuid,
  requested_travel_mode text
)
returns public.itinerary_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_item public.itinerary_items;
  updated_item public.itinerary_items;
  normalized_mode text := upper(trim(requested_travel_mode));
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if normalized_mode not in ('DRIVE', 'TRANSIT', 'WALK', 'BICYCLE') then raise exception 'Travel mode is invalid'; end if;

  select * into existing_item from public.itinerary_items where id = requested_item_id for update;
  if existing_item.id is null then raise exception 'Itinerary item not found'; end if;
  if not private.can_edit_trip(existing_item.trip_id) then raise exception 'Only owners and editors can change travel mode'; end if;

  update public.itinerary_items
  set route_travel_mode = normalized_mode, updated_at = now()
  where id = requested_item_id
  returning * into updated_item;
  return updated_item;
end;
$$;

create or replace function public.update_itinerary_route_mode(
  requested_item_id uuid,
  requested_travel_mode text
)
returns public.itinerary_items
language sql
security invoker
set search_path = ''
as $$
  select private.update_itinerary_route_mode(requested_item_id, requested_travel_mode);
$$;

revoke all on function private.update_itinerary_route_mode(uuid, text) from public, anon;
grant execute on function private.update_itinerary_route_mode(uuid, text) to authenticated;
revoke all on function public.update_itinerary_route_mode(uuid, text) from public, anon;
grant execute on function public.update_itinerary_route_mode(uuid, text) to authenticated;
