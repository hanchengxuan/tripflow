-- Acceptance for shift_itinerary_items against a local Supabase stack.
-- Everything runs inside one transaction and is rolled back.
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'editor@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Editor"}', now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'viewer@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Viewer"}', now(), now());

create or replace function pg_temp.act_as(user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create or replace function pg_temp.expect_error(statement text, expected text) returns void language plpgsql as $$
declare
  failure text;
begin
  begin
    execute statement;
  exception when others then
    failure := sqlerrm;
  end;
  if failure is null then raise exception 'statement should have failed: %', statement; end if;
  if position(expected in failure) = 0 then raise exception 'expected "%" but got "%"', expected, failure; end if;
end;
$$;

create or replace function pg_temp.check(condition boolean, message text) returns void language plpgsql as $$
begin
  if not condition then raise exception 'check failed: %', message; end if;
end;
$$;

select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select (public.create_trip('Shift test', '2026-10-20', '2026-10-25', 'JPY', 'Asia/Tokyo')).id as trip_id \gset
reset role;
insert into public.trip_members (trip_id, user_id, role) values (:'trip_id', '22222222-2222-2222-2222-222222222222', 'viewer');
insert into public.itinerary_items (id, trip_id, created_by, kind, title, starts_at, ends_at, location_label)
values
  ('aaaaaaaa-0000-4000-8000-0000000000a1', :'trip_id', '11111111-1111-1111-1111-111111111111', 'lodging', 'Hotel', '2026-10-20T22:00:00Z', '2026-10-23T02:00:00Z', 'Marunouchi'),
  ('aaaaaaaa-0000-4000-8000-0000000000a2', :'trip_id', '11111111-1111-1111-1111-111111111111', 'transport', 'Flight', '2026-10-20T09:30:00Z', '2026-10-20T20:30:00Z', null);
insert into public.itinerary_items (id, trip_id, created_by, kind, title, starts_at, ends_at, location_label, linked_stay_id)
values ('aaaaaaaa-0000-4000-8000-0000000000a3', :'trip_id', '11111111-1111-1111-1111-111111111111', 'transport', 'Transfer', '2026-10-20T21:00:00Z', '2026-10-20T22:00:00Z', 'Marunouchi', 'aaaaaaaa-0000-4000-8000-0000000000a1');

\set delay '[{"itemId":"aaaaaaaa-0000-4000-8000-0000000000a2","fromStartsAt":"2026-10-20T09:30:00Z","fromEndsAt":"2026-10-20T20:30:00Z","startsAt":"2026-10-20T11:30:00Z","endsAt":"2026-10-20T22:30:00Z"},{"itemId":"aaaaaaaa-0000-4000-8000-0000000000a3","fromStartsAt":"2026-10-20T21:00:00Z","fromEndsAt":"2026-10-20T22:00:00Z","startsAt":"2026-10-20T23:00:00Z","endsAt":"2026-10-21T00:00:00Z"},{"itemId":"aaaaaaaa-0000-4000-8000-0000000000a1","fromStartsAt":"2026-10-20T22:00:00Z","fromEndsAt":"2026-10-23T02:00:00Z","startsAt":"2026-10-21T00:00:00Z","endsAt":"2026-10-23T02:00:00Z"}]'

-- A viewer cannot move plans.
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
select pg_temp.expect_error(format('select public.shift_itinerary_items(%L, %L::jsonb)', :'trip_id', :'delay'), 'Only owners and editors');

-- Moving a transfer without its hotel would break the arrival rule, so nothing is saved.
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select pg_temp.expect_error(format('select public.shift_itinerary_items(%L, %L::jsonb)', :'trip_id',
  '[{"itemId":"aaaaaaaa-0000-4000-8000-0000000000a3","fromStartsAt":"2026-10-20T21:00:00Z","fromEndsAt":"2026-10-20T22:00:00Z","startsAt":"2026-10-20T23:00:00Z","endsAt":"2026-10-21T00:00:00Z"}]'), 'Hotel transfer arrival must match check-in');
select pg_temp.check((select starts_at from public.itinerary_items where id = 'aaaaaaaa-0000-4000-8000-0000000000a3') = '2026-10-20T21:00:00Z', 'failed shift saves nothing');

-- A shift past the last trip day is refused.
select pg_temp.expect_error(format('select public.shift_itinerary_items(%L, %L::jsonb)', :'trip_id',
  '[{"itemId":"aaaaaaaa-0000-4000-8000-0000000000a2","fromStartsAt":"2026-10-20T09:30:00Z","fromEndsAt":"2026-10-20T20:30:00Z","startsAt":"2026-10-25T14:00:00Z","endsAt":"2026-10-25T16:00:00Z"}]'), 'outside the trip dates');

-- The full delay moves flight, transfer and check-in together.
select pg_temp.check(public.shift_itinerary_items(:'trip_id', :'delay'::jsonb) = 3, 'three plans moved');
reset role;
select pg_temp.check((select starts_at from public.itinerary_items where id = 'aaaaaaaa-0000-4000-8000-0000000000a1') = '2026-10-21T00:00:00Z', 'check-in follows the transfer');
select pg_temp.check((select ends_at from public.itinerary_items where id = 'aaaaaaaa-0000-4000-8000-0000000000a1') = '2026-10-23T02:00:00Z', 'check-out is kept');
select pg_temp.check((select count(*) from public.itinerary_items where linked_stay_id = 'aaaaaaaa-0000-4000-8000-0000000000a1') = 1, 'the linked transfer is kept');

-- Sending the same delay again is refused instead of moving the plans twice.
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select pg_temp.expect_error(format('select public.shift_itinerary_items(%L, %L::jsonb)', :'trip_id', :'delay'), 'Plans changed since the preview');
reset role;
select pg_temp.check((select starts_at from public.itinerary_items where id = 'aaaaaaaa-0000-4000-8000-0000000000a2') = '2026-10-20T11:30:00Z', 'flight moved exactly once');

select 'shift acceptance passed' as result;
rollback;
