-- Applies a delay to several plans at once. Each shift names the times the client saw, so a
-- retry or a concurrent edit fails instead of moving a plan twice, and nothing is saved
-- unless every plan moves.
create function private.shift_itinerary_items(requested_trip_id uuid, shifts jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  trip public.trips;
  shift jsonb;
  item public.itinerary_items;
  new_start timestamptz;
  new_end timestamptz;
  shifted_count integer := 0;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not private.can_edit_trip(requested_trip_id) then raise exception 'Only owners and editors can move plans'; end if;
  select * into trip from public.trips where id = requested_trip_id;
  if shifts is null or jsonb_typeof(shifts) <> 'array' or jsonb_array_length(shifts) not between 1 and 30 then raise exception 'Move 1 to 30 plans'; end if;

  for shift in select value from jsonb_array_elements(shifts) loop
    select * into item from public.itinerary_items
    where id = (shift->>'itemId')::uuid and trip_id = requested_trip_id
    for update;
    if item.id is null then raise exception 'Plan not found'; end if;
    if item.starts_at is distinct from (shift->>'fromStartsAt')::timestamptz
      or item.ends_at is distinct from (shift->>'fromEndsAt')::timestamptz then
      raise exception 'Plans changed since the preview. Refresh and try again';
    end if;
    new_start := (shift->>'startsAt')::timestamptz;
    new_end := (shift->>'endsAt')::timestamptz;
    if new_start is null or (item.ends_at is null) <> (new_end is null) or (new_end is not null and new_end <= new_start) then
      raise exception 'Invalid plan time';
    end if;
    if (new_start at time zone trip.default_time_zone)::date < trip.starts_on
      or (coalesce(new_end, new_start) at time zone trip.default_time_zone)::date > trip.ends_on then
      raise exception 'A moved plan would fall outside the trip dates';
    end if;
    update public.itinerary_items
    set starts_at = new_start, ends_at = new_end, updated_at = now(), version = version + 1
    where id = item.id;
    shifted_count := shifted_count + 1;
  end loop;

  if exists (
    select 1 from public.itinerary_items transfer
    join public.itinerary_items stay on stay.id = transfer.linked_stay_id
    where transfer.trip_id = requested_trip_id and transfer.ends_at is distinct from stay.starts_at
  ) then
    raise exception 'Hotel transfer arrival must match check-in';
  end if;
  return shifted_count;
end;
$$;

create function public.shift_itinerary_items(requested_trip_id uuid, shifts jsonb)
returns integer language sql security invoker set search_path = '' as $$
  select private.shift_itinerary_items(requested_trip_id, shifts);
$$;

revoke all on function private.shift_itinerary_items(uuid, jsonb) from public, anon;
revoke all on function public.shift_itinerary_items(uuid, jsonb) from public, anon;
grant execute on function private.shift_itinerary_items(uuid, jsonb) to authenticated;
grant execute on function public.shift_itinerary_items(uuid, jsonb) to authenticated;
