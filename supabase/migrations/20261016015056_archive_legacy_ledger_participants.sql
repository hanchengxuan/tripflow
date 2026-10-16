with participants as (
  select e.trip_id, p.user_id
  from public.expenses e
  join public.expense_payers p on p.expense_id = e.id
  union
  select e.trip_id, s.user_id
  from public.expenses e
  join public.expense_allocation_groups g on g.expense_id = e.id
  join public.expense_shares s on s.allocation_group_id = g.id
  union
  select trip_id, from_user_id from public.settlements
  union
  select trip_id, to_user_id from public.settlements
)
insert into public.trip_member_archives (trip_id, user_id, display_name, avatar_path)
select p.trip_id, p.user_id, profile.display_name, profile.avatar_path
from participants p
join public.profiles profile on profile.id = p.user_id
where not exists (
  select 1 from public.trip_members m
  where m.trip_id = p.trip_id and m.user_id = p.user_id
)
on conflict (trip_id, user_id) do nothing;
