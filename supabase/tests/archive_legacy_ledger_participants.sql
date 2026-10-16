begin;
create temp table profiles (id text primary key, display_name text, avatar_path text);
create temp table expenses (id text primary key, trip_id text);
create temp table expense_payers (expense_id text, user_id text);
create temp table expense_allocation_groups (id text primary key, expense_id text);
create temp table expense_shares (allocation_group_id text, user_id text);
create temp table settlements (trip_id text, from_user_id text, to_user_id text);
create temp table trip_members (trip_id text, user_id text);
create temp table trip_member_archives (
  trip_id text, user_id text, display_name text, avatar_path text,
  primary key (trip_id, user_id)
);
insert into profiles values
  ('payer', 'Payer', 'payer/avatar.png'),
  ('sharer', 'Sharer', null),
  ('sender', 'Sender', null),
  ('recipient', 'Recipient', null),
  ('active', 'Active', null),
  ('archived', 'New name', null),
  ('deleted', 'Deleted traveller', null);
insert into expenses values ('expense', 'trip'), ('other-expense', 'other-trip');
insert into expense_payers values
  ('expense', 'payer'), ('expense', 'active'), ('expense', 'archived'),
  ('expense', 'deleted'), ('other-expense', 'active');
insert into expense_allocation_groups values ('group', 'expense');
insert into expense_shares values ('group', 'sharer'), ('group', 'payer');
insert into settlements values ('trip', 'sender', 'recipient');
insert into trip_members values ('trip', 'active');
insert into trip_member_archives values ('trip', 'archived', 'Historical name', 'old/avatar.png');
with participants as (
  select e.trip_id, p.user_id
  from pg_temp.expenses e
  join pg_temp.expense_payers p on p.expense_id = e.id
  union
  select e.trip_id, s.user_id
  from pg_temp.expenses e
  join pg_temp.expense_allocation_groups g on g.expense_id = e.id
  join pg_temp.expense_shares s on s.allocation_group_id = g.id
  union
  select trip_id, from_user_id from pg_temp.settlements
  union
  select trip_id, to_user_id from pg_temp.settlements
)
insert into pg_temp.trip_member_archives (trip_id, user_id, display_name, avatar_path)
select p.trip_id, p.user_id, profile.display_name, profile.avatar_path
from participants p
join pg_temp.profiles profile on profile.id = p.user_id
where not exists (
  select 1 from pg_temp.trip_members m
  where m.trip_id = p.trip_id and m.user_id = p.user_id
)
on conflict (trip_id, user_id) do nothing;

do $$
begin
  if (select count(*) from pg_temp.trip_member_archives) <> 7 then
    raise exception 'Expected six legacy identities plus existing archive';
  end if;
  if exists (
    select expected.user_id from (values ('payer'), ('sharer'), ('sender'), ('recipient'), ('deleted')) expected(user_id)
    where not exists (select 1 from pg_temp.trip_member_archives a where a.trip_id = 'trip' and a.user_id = expected.user_id)
  ) then raise exception 'Missing payer, sharer, settlement party, or deleted profile'; end if;
  if exists (select 1 from pg_temp.trip_member_archives where trip_id = 'trip' and user_id = 'active') then
    raise exception 'Current member must not be archived';
  end if;
  if not exists (select 1 from pg_temp.trip_member_archives where trip_id = 'other-trip' and user_id = 'active') then
    raise exception 'Membership exclusion must be trip-scoped';
  end if;
  if not exists (select 1 from pg_temp.trip_member_archives where user_id = 'archived' and display_name = 'Historical name' and avatar_path = 'old/avatar.png') then
    raise exception 'Existing archive must retain its identity snapshot';
  end if;
  if not exists (select 1 from pg_temp.trip_member_archives where user_id = 'payer' and avatar_path = 'payer/avatar.png') then
    raise exception 'Avatar snapshot must be retained';
  end if;
end;
$$;
with participants as (
  select e.trip_id, p.user_id
  from pg_temp.expenses e
  join pg_temp.expense_payers p on p.expense_id = e.id
  union
  select e.trip_id, s.user_id
  from pg_temp.expenses e
  join pg_temp.expense_allocation_groups g on g.expense_id = e.id
  join pg_temp.expense_shares s on s.allocation_group_id = g.id
  union
  select trip_id, from_user_id from pg_temp.settlements
  union
  select trip_id, to_user_id from pg_temp.settlements
)
insert into pg_temp.trip_member_archives (trip_id, user_id, display_name, avatar_path)
select p.trip_id, p.user_id, profile.display_name, profile.avatar_path
from participants p
join pg_temp.profiles profile on profile.id = p.user_id
where not exists (
  select 1 from pg_temp.trip_members m
  where m.trip_id = p.trip_id and m.user_id = p.user_id
)
on conflict (trip_id, user_id) do nothing;

do $$
begin
  if (select count(*) from pg_temp.trip_member_archives) <> 7 then
    raise exception 'Rerunning the backfill must not add duplicates';
  end if;
end;
$$;
rollback;
