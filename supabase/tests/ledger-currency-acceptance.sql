begin;
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
 ('c1111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ledger-a@example.test','',now(),'{"provider":"email","providers":["email"]}','{"display_name":"Ledger A"}',now(),now()),
 ('c2222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ledger-b@example.test','',now(),'{"provider":"email","providers":["email"]}','{"display_name":"Ledger B"}',now(),now());

create function pg_temp.check(condition boolean, message text) returns void language plpgsql as $$
begin
 if condition is distinct from true then raise exception 'Ledger acceptance: %', message; end if;
end;
$$;
select set_config('request.jwt.claims','{"sub":"c1111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
set local role authenticated;
create temp table ledger_currency_fixture as
 select (public.create_trip('Synthetic currency acceptance','2026-12-01','2026-12-10','CNY','Asia/Shanghai')).id as trip_id;
reset role;
insert into public.trip_members(trip_id,user_id,role)
 select trip_id,'c2222222-2222-4222-8222-222222222222','editor' from ledger_currency_fixture;
set local role authenticated;
select public.create_equal_expense(trip_id,'Synthetic HKD expense','HKD',10000,
 'c1111111-1111-4111-8111-111111111111',array['c2222222-2222-4222-8222-222222222222']::uuid[],now(),null,'CNY',9200,0.92,'manual')
from ledger_currency_fixture;
reset role;
select pg_temp.check(private.member_base_currency_balance(trip_id,'c2222222-2222-4222-8222-222222222222','HKD')=-10000,'HKD debt must use HKD amounts, not CNY amounts') from ledger_currency_fixture;
select pg_temp.check(private.member_base_currency_balance(trip_id,'c2222222-2222-4222-8222-222222222222','CNY')=-9200,'CNY conversion is preserved') from ledger_currency_fixture;

select set_config('request.jwt.claims','{"sub":"c2222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
set local role authenticated;
create temp table ledger_currency_payment as select public.record_settlement(trip_id,'c1111111-1111-4111-8111-111111111111','HKD',4000) as id from ledger_currency_fixture;
reset role;
select pg_temp.check(private.member_currency_balance(trip_id,'c2222222-2222-4222-8222-222222222222','HKD')=-6000,'partial original-currency payment reduces remaining debt') from ledger_currency_fixture;
set local role authenticated;
select public.unrecord_settlement(id) from ledger_currency_payment;
reset role;
select pg_temp.check(private.member_currency_balance(trip_id,'c2222222-2222-4222-8222-222222222222','HKD')=-10000,'undo restores original debt') from ledger_currency_fixture;

update public.trips set home_currency='HKD' where id=(select trip_id from ledger_currency_fixture);
set local role authenticated;
create temp table ledger_currency_full_payment as select public.record_settlement(trip_id,'c1111111-1111-4111-8111-111111111111','HKD',10000,'HKD',10000,1,'manual') as id from ledger_currency_fixture;
reset role;
select pg_temp.check(private.member_base_currency_balance(trip_id,'c2222222-2222-4222-8222-222222222222','HKD')=0,'normalized payment settles the corrected HKD balance') from ledger_currency_fixture;
set local role authenticated;
select public.unrecord_settlement(id) from ledger_currency_full_payment;
reset role;
select pg_temp.check(private.member_base_currency_balance(trip_id,'c2222222-2222-4222-8222-222222222222','HKD')=-10000,'undo restores normalized debt') from ledger_currency_fixture;

select set_config('request.jwt.claims','{"sub":"c3333333-3333-4333-8333-333333333333","role":"authenticated"}',true);
set local role authenticated;
do $$
begin
 begin
  perform public.record_settlement((select trip_id from ledger_currency_fixture),'c1111111-1111-4111-8111-111111111111','HKD',100);
  raise exception 'Outsider settlement was accepted';
 exception when raise_exception then
  if sqlerrm <> 'Both settlement participants must be trip members' then raise; end if;
 end;
end;
$$;
reset role;
set constraints all immediate;
select 'ledger currency acceptance passed' as result;
rollback;
