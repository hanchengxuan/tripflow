-- Acceptance for trip polls against a local Supabase stack.
-- Everything runs inside one transaction and is rolled back.
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Owner"}', now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'viewer@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Viewer"}', now(), now()),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outsider@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Outsider"}', now(), now());

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
select (public.create_trip('Poll test', '2026-12-12', '2026-12-20', 'JPY', 'Asia/Tokyo')).id as trip_id \gset
reset role;
insert into public.trip_members (trip_id, user_id, role) values (:'trip_id', '22222222-2222-2222-2222-222222222222', 'viewer');

-- An editor starts a poll; the options keep their order.
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select public.create_trip_poll(:'trip_id', '  晚饭吃什么？ ', array['拉面', ' 寿司 ', '烤肉']) as poll_id \gset
select pg_temp.check((select question from public.trip_polls where id = :'poll_id') = '晚饭吃什么？', 'question is trimmed');
select pg_temp.check((select string_agg(label, ',' order by position) from public.trip_poll_options where poll_id = :'poll_id') = '拉面,寿司,烤肉', 'options keep order and are trimmed');
select id as ramen from public.trip_poll_options where poll_id = :'poll_id' and position = 0 \gset
select id as sushi from public.trip_poll_options where poll_id = :'poll_id' and position = 1 \gset

select pg_temp.expect_error(format('select public.create_trip_poll(%L, %L, array[%L])', :'trip_id', 'Q', 'only one'), 'Add 2 to 6 options');
select pg_temp.expect_error(format('select public.create_trip_poll(%L, %L, array[%L, %L])', :'trip_id', 'Q', 'Same', 'same'), 'Options must be different');
select pg_temp.expect_error(format('select public.create_trip_poll(%L, %L, array[%L, %L], now() - interval ''1 minute'')', :'trip_id', 'Q', 'A', 'B'), 'deadline must be in the future');

-- Direct writes are not allowed; everything goes through the functions.
select pg_temp.expect_error(format('insert into public.trip_poll_votes (poll_id, user_id, option_id) values (%L, %L, %L)', :'poll_id', '11111111-1111-1111-1111-111111111111', :'ramen'), 'permission denied');

-- A viewer can vote and change their vote, but cannot start or close a poll.
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
select public.vote_trip_poll(:'poll_id', :'ramen');
select public.vote_trip_poll(:'poll_id', :'sushi');
select pg_temp.check((select count(*) from public.trip_poll_votes where poll_id = :'poll_id') = 1, 'one vote per traveller');
select pg_temp.check((select option_id from public.trip_poll_votes where poll_id = :'poll_id') = :'sushi', 'changed vote is kept');
select pg_temp.expect_error(format('select public.create_trip_poll(%L, %L, array[%L, %L])', :'trip_id', 'Q', 'A', 'B'), 'Only trip editors');
select pg_temp.expect_error(format('select public.close_trip_poll(%L, %L)', :'poll_id', :'sushi'), 'Only the poll creator or a trip editor');

-- Someone outside the trip cannot see or vote.
select pg_temp.act_as('33333333-3333-3333-3333-333333333333');
select pg_temp.check((select count(*) from public.trip_polls) = 0, 'outsider sees no polls');
select pg_temp.check((select count(*) from public.trip_poll_votes) = 0, 'outsider sees no votes');
select pg_temp.expect_error(format('select public.vote_trip_poll(%L, %L)', :'poll_id', :'ramen'), 'Poll not found');

-- An option from another poll is rejected.
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select public.create_trip_poll(:'trip_id', '明天去哪？', array['奈良', '京都']) as other_poll \gset
select pg_temp.expect_error(format('select public.vote_trip_poll(%L, %L)', :'other_poll', :'ramen'), 'Choose an option from this poll');

-- The creator decides; votes after that are rejected.
select public.close_trip_poll(:'poll_id', :'sushi');
select pg_temp.check((select selected_option_id from public.trip_polls where id = :'poll_id') = :'sushi', 'final selection is stored');
select pg_temp.expect_error(format('select public.close_trip_poll(%L, %L)', :'poll_id', :'ramen'), 'already decided');
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
select pg_temp.expect_error(format('select public.vote_trip_poll(%L, %L)', :'poll_id', :'ramen'), 'This poll is closed');

-- A passed deadline stops voting even before anyone decides.
reset role;
update public.trip_polls set closes_at = now() - interval '1 minute' where id = :'other_poll';
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
select id as nara from public.trip_poll_options where poll_id = :'other_poll' and position = 0 \gset
select pg_temp.expect_error(format('select public.vote_trip_poll(%L, %L)', :'other_poll', :'nara'), 'This poll is closed');

-- Only the creator or an editor can delete; deleting removes options and votes.
select pg_temp.expect_error(format('select public.delete_trip_poll(%L)', :'poll_id'), 'Only the poll creator or a trip editor');
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select public.delete_trip_poll(:'poll_id');
reset role;
select pg_temp.check(not exists (select 1 from public.trip_poll_options where poll_id = :'poll_id'), 'options deleted with poll');
select pg_temp.check(not exists (select 1 from public.trip_poll_votes where poll_id = :'poll_id'), 'votes deleted with poll');

select 'poll acceptance passed' as result;
rollback;
