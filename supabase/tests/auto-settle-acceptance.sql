-- Acceptance for automatic expense settlement against a local Supabase stack.
-- Everything runs inside one transaction and is rolled back; deferred checks
-- are forced with SET CONSTRAINTS ALL IMMEDIATE, as a commit would.
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"A"}', now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"B"}', now(), now());

create or replace function pg_temp.act_as(user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create or replace function pg_temp.check(condition boolean, message text) returns void language plpgsql as $$
begin
  if not condition then raise exception 'check failed: %', message; end if;
end;
$$;

create or replace function pg_temp.settled(expense_title text) returns text language sql as $$
  select coalesce(settlement_source, 'unsettled') from public.expenses where title = expense_title;
$$;

-- A one-person trip: an expense paid by and for the same traveller needs no transfer.
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select (public.create_trip('Solo', '2026-12-12', '2026-12-20', 'JPY', 'Asia/Tokyo')).id as solo \gset
select public.create_equal_expense(:'solo', 'Castle ticket', 'JPY', 2400, '11111111-1111-1111-1111-111111111111', array['11111111-1111-1111-1111-111111111111']::uuid[], now(), null, 'JPY', 2400, 1, 'same-currency');
set constraints all immediate;
set constraints all deferred;
reset role;
select pg_temp.check(pg_temp.settled('Castle ticket') = 'automatic', 'self-paid expense settles automatically');

-- A shared trip: B owes A until a transfer is recorded.
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select (public.create_trip('Pair', '2026-12-12', '2026-12-20', 'JPY', 'Asia/Tokyo')).id as pair \gset
reset role;
insert into public.trip_members (trip_id, user_id, role) values (:'pair', '22222222-2222-2222-2222-222222222222', 'editor');
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select public.create_equal_expense(:'pair', 'Dinner', 'JPY', 1000, '11111111-1111-1111-1111-111111111111', array['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222']::uuid[], now(), null, 'JPY', 1000, 1, 'same-currency');
set constraints all immediate;
set constraints all deferred;
reset role;
select pg_temp.check(pg_temp.settled('Dinner') = 'unsettled', 'shared expense stays unsettled while B owes A');

-- A self-paid expense in a trip with an outstanding debt stays unsettled with it.
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
select public.create_equal_expense(:'pair', 'Snack', 'JPY', 300, '22222222-2222-2222-2222-222222222222', array['22222222-2222-2222-2222-222222222222']::uuid[], now(), null, 'JPY', 300, 1, 'same-currency');
set constraints all immediate;
set constraints all deferred;
reset role;
select pg_temp.check(pg_temp.settled('Snack') = 'unsettled', 'ledger-wide status: nothing settles while a debt is open');

-- Paying the debt settles everything, as before.
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
select public.record_settlement(:'pair', '11111111-1111-1111-1111-111111111111', 'JPY', 500, 'JPY', 500, 1, 'same-currency');
set constraints all immediate;
set constraints all deferred;
reset role;
select pg_temp.check(pg_temp.settled('Dinner') = 'automatic' and pg_temp.settled('Snack') = 'automatic', 'transfer settles the whole ledger');

-- A new shared expense reopens the ledger.
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
select public.create_equal_expense(:'pair', 'Taxi', 'JPY', 2000, '22222222-2222-2222-2222-222222222222', array['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222']::uuid[], now(), null, 'JPY', 2000, 1, 'same-currency');
set constraints all immediate;
set constraints all deferred;
reset role;
select pg_temp.check(pg_temp.settled('Taxi') = 'unsettled' and pg_temp.settled('Dinner') = 'unsettled', 'a new debt unsettles the automatic flags');

-- Editing it so B pays only for B balances the ledger again.
select pg_temp.act_as('22222222-2222-2222-2222-222222222222');
select public.update_custom_expense((select id from public.expenses where title = 'Taxi'), 'Taxi', 'JPY', 2000,
  array['22222222-2222-2222-2222-222222222222']::uuid[], array[2000]::bigint[],
  array['22222222-2222-2222-2222-222222222222']::uuid[], array[2000]::bigint[], 'JPY', 2000, 1, 'same-currency');
set constraints all immediate;
set constraints all deferred;
reset role;
select pg_temp.check(pg_temp.settled('Taxi') = 'automatic' and pg_temp.settled('Dinner') = 'automatic', 'an edit that removes the debt settles again');

-- A manual mark survives a new debt that unsettles the automatic flags.
update public.expenses set settlement_source = 'manual' where title = 'Snack';
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select public.create_equal_expense(:'pair', 'Museum', 'JPY', 1600, '11111111-1111-1111-1111-111111111111', array['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222']::uuid[], now(), null, 'JPY', 1600, 1, 'same-currency');
set constraints all immediate;
set constraints all deferred;
reset role;
select pg_temp.check(pg_temp.settled('Snack') = 'manual' and pg_temp.settled('Dinner') = 'unsettled', 'manual mark is kept while automatic ones reopen');

-- Deleting the expense that created the debt balances the ledger again.
delete from public.expenses where title = 'Museum';
set constraints all immediate;
set constraints all deferred;
select pg_temp.check(pg_temp.settled('Dinner') = 'automatic', 'deleting the debt settles the ledger');

select 'auto-settle acceptance passed' as result;
rollback;
