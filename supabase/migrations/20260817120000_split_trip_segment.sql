-- Branching a trip: "split from here".
--
-- The tables, policies, and visibility helpers for segments shipped with
-- `initial_schema` and have never been written to. This adds the one operation
-- the client cannot express safely as separate statements: create a branch,
-- give it members, and move the plans that fall inside it — all or nothing.
--
-- Deliberately does NOT touch expenses. A branch scopes who is travelling
-- together and who can see which plans; the ledger stays one ledger for the
-- whole trip so a single settlement still closes it out. Splitting money along
-- a branch would strand balances that were incurred before the split.

create or replace function private.split_trip_segment(
  requested_trip_id uuid,
  segment_name text,
  segment_starts_at timestamptz,
  segment_ends_at timestamptz,
  segment_visibility public.segment_visibility,
  member_ids uuid[]
)
returns public.segments
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_name text := nullif(trim(segment_name), '');
  distinct_member_ids uuid[];
  created_segment public.segments;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.can_edit_trip(requested_trip_id) then
    raise exception 'Only trip owners and editors can split a trip';
  end if;

  if normalized_name is null or char_length(normalized_name) > 120 then
    raise exception 'A branch needs a name of 1 to 120 characters';
  end if;

  if segment_ends_at < segment_starts_at then
    raise exception 'A branch cannot end before it starts';
  end if;

  select coalesce(array_agg(distinct member_id), '{}'::uuid[])
    into distinct_member_ids
    from unnest(coalesce(member_ids, '{}'::uuid[])) as member_id;

  if array_length(distinct_member_ids, 1) is null then
    raise exception 'A branch needs at least one traveller';
  end if;

  -- Every listed traveller must already be on the trip. Without this a branch
  -- could grant a stranger read access to plans through `can_read_segment`.
  if exists (
    select 1
    from unnest(distinct_member_ids) as member_id
    where not public.is_user_trip_member(requested_trip_id, member_id)
  ) then
    raise exception 'Everyone on a branch must already be a traveller on this trip';
  end if;

  insert into public.segments (trip_id, created_by, name, starts_at, ends_at, visibility)
  values (requested_trip_id, current_user_id, normalized_name, segment_starts_at, segment_ends_at, segment_visibility)
  returning * into created_segment;

  insert into public.segment_members (segment_id, user_id)
  select created_segment.id, member_id
  from unnest(distinct_member_ids) as member_id;

  -- Only plans that belong to the whole trip move. Plans already claimed by
  -- another branch stay where they are, so splitting twice never quietly
  -- reassigns someone else's branch.
  update public.itinerary_items
     set segment_id = created_segment.id,
         updated_at = now()
   where trip_id = requested_trip_id
     and segment_id is null
     and starts_at >= segment_starts_at
     and starts_at <= segment_ends_at;

  return created_segment;
end;
$$;

create or replace function public.split_trip_segment(
  requested_trip_id uuid,
  segment_name text,
  segment_starts_at timestamptz,
  segment_ends_at timestamptz,
  segment_visibility public.segment_visibility,
  member_ids uuid[]
)
returns public.segments
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.split_trip_segment(
    requested_trip_id,
    segment_name,
    segment_starts_at,
    segment_ends_at,
    segment_visibility,
    member_ids
  );
$$;

-- The public wrapper is security invoker, so it runs as the caller: the
-- callable role needs execute on the private function too, matching
-- `move_itinerary_between_trips`.
revoke all on function private.split_trip_segment(uuid, text, timestamptz, timestamptz, public.segment_visibility, uuid[]) from public, anon;
revoke all on function public.split_trip_segment(uuid, text, timestamptz, timestamptz, public.segment_visibility, uuid[]) from public, anon;
grant execute on function private.split_trip_segment(uuid, text, timestamptz, timestamptz, public.segment_visibility, uuid[]) to authenticated;
grant execute on function public.split_trip_segment(uuid, text, timestamptz, timestamptz, public.segment_visibility, uuid[]) to authenticated;

-- Dissolving a branch returns its plans to the whole trip rather than deleting
-- them; the row cascade on `segments` would take the itinerary with it.
create or replace function private.dissolve_trip_segment(requested_segment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_segment public.segments;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select * into target_segment from public.segments where id = requested_segment_id;
  if target_segment.id is null then
    raise exception 'Branch not found';
  end if;

  if not public.can_edit_trip(target_segment.trip_id) then
    raise exception 'Only trip owners and editors can dissolve a branch';
  end if;

  update public.itinerary_items
     set segment_id = null,
         updated_at = now()
   where segment_id = requested_segment_id;

  delete from public.segments where id = requested_segment_id;
end;
$$;

create or replace function public.dissolve_trip_segment(requested_segment_id uuid)
returns void
language sql
volatile
security invoker
set search_path = ''
as $$ select private.dissolve_trip_segment(requested_segment_id); $$;

revoke all on function private.dissolve_trip_segment(uuid) from public, anon;
revoke all on function public.dissolve_trip_segment(uuid) from public, anon;
grant execute on function private.dissolve_trip_segment(uuid) to authenticated;
grant execute on function public.dissolve_trip_segment(uuid) to authenticated;
