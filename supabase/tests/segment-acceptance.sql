-- Acceptance for split_trip_segment / dissolve_trip_segment against a local
-- Supabase stack. Everything runs inside one transaction and is rolled back.
\set ON_ERROR_STOP on
begin;

-- Two travellers. The profile row is provisioned by the auth trigger.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"A"}', now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"B"}', now(), now());

-- Act as A.
create or replace function pg_temp.act_as(user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select auth.uid() as acting_as_a;

-- Trip owned by A, with B added as a traveller.
select (public.create_trip('Split test', '2026-12-12', '2026-12-20', 'HKD', 'Asia/Hong_Kong')).id as trip_id \gset

reset role;
insert into public.trip_members (trip_id, user_id, role)
values (:'trip_id', '22222222-2222-2222-2222-222222222222', 'editor');

-- Three plans: before, inside, and after the branch window.
insert into public.itinerary_items (trip_id, created_by, kind, title, starts_at)
values
  (:'trip_id', '11111111-1111-1111-1111-111111111111', 'activity', 'before',  '2026-12-13T02:00:00Z'),
  (:'trip_id', '11111111-1111-1111-1111-111111111111', 'activity', 'inside',  '2026-12-17T02:00:00Z'),
  (:'trip_id', '11111111-1111-1111-1111-111111111111', 'activity', 'after',   '2026-12-19T02:00:00Z');

select pg_temp.act_as('11111111-1111-1111-1111-111111111111');

-- 1. A stranger cannot be put on a branch.
do $$
begin
  perform public.split_trip_segment(
    (select id from public.trips where name = 'Split test'),
    'Bad branch', '2026-12-16T00:00:00Z', '2026-12-18T00:00:00Z',
    'members_only', array['33333333-3333-3333-3333-333333333333']::uuid[]);
  raise exception 'FAIL: a non-member was accepted onto a branch';
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  raise notice 'PASS non-member rejected: %', sqlerrm;
end;
$$;

-- 2. Split the back half, with only A on it.
select (public.split_trip_segment(
  (select id from public.trips where name = 'Split test'),
  'Back half', '2026-12-16T00:00:00Z', '2026-12-18T00:00:00Z',
  'members_only', array['11111111-1111-1111-1111-111111111111']::uuid[])).id as segment_id \gset

reset role;
select title, (segment_id is not null) as branched
  from public.itinerary_items
 where trip_id = (select id from public.trips where name = 'Split test')
 order by starts_at;

-- 3. The privacy boundary: B is a trip editor but not on the branch.
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
select coalesce(string_agg(title, ','), '(none)') as visible_to_b
  from public.itinerary_items
 where trip_id = (select id from public.trips where name = 'Split test');

select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select coalesce(string_agg(title, ','), '(none)') as visible_to_a
  from public.itinerary_items
 where trip_id = (select id from public.trips where name = 'Split test');

-- 4. Dissolving returns the plans to the whole trip instead of deleting them.
select public.dissolve_trip_segment((select id from public.segments where name = 'Back half'));

select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
select coalesce(string_agg(title, ','), '(none)') as visible_to_b_after_dissolve
  from public.itinerary_items
 where trip_id = (select id from public.trips where name = 'Split test');

reset role;
select count(*) as segments_left from public.segments where name = 'Back half';

rollback;
