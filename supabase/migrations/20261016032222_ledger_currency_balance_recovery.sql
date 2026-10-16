create or replace function private.member_base_currency_balance(
  requested_trip_id uuid,
  target_user_id uuid,
  requested_base_currency text
)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(effect), 0)::bigint
  from (
    select coalesce(case when e.base_currency = upper(requested_base_currency) then ep.base_amount_minor end, case when e.currency = upper(requested_base_currency) then ep.amount_minor end) as effect
    from public.expense_payers ep
    join public.expenses e on e.id = ep.expense_id
    where e.trip_id = requested_trip_id and ep.user_id = target_user_id
      and (e.base_currency = upper(requested_base_currency) or e.currency = upper(requested_base_currency))
    union all
    select -coalesce(case when e.base_currency = upper(requested_base_currency) then es.base_amount_minor end, case when e.currency = upper(requested_base_currency) then es.amount_minor end)
    from public.expense_shares es
    join public.expense_allocation_groups eag on eag.id = es.allocation_group_id
    join public.expenses e on e.id = eag.expense_id
    where e.trip_id = requested_trip_id and es.user_id = target_user_id
      and (e.base_currency = upper(requested_base_currency) or e.currency = upper(requested_base_currency))
    union all
    select coalesce(case when s.base_currency = upper(requested_base_currency) then s.base_amount_minor end, case when s.currency = upper(requested_base_currency) then s.amount_minor end)
    from public.settlements s
    where s.trip_id = requested_trip_id and s.from_user_id = target_user_id
      and (s.base_currency = upper(requested_base_currency) or s.currency = upper(requested_base_currency))
    union all
    select -coalesce(case when s.base_currency = upper(requested_base_currency) then s.base_amount_minor end, case when s.currency = upper(requested_base_currency) then s.amount_minor end)
    from public.settlements s
    where s.trip_id = requested_trip_id and s.to_user_id = target_user_id
      and (s.base_currency = upper(requested_base_currency) or s.currency = upper(requested_base_currency))
  ) effects;
$$;
