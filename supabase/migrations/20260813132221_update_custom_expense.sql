-- Allow an authorized traveller to correct an expense without replacing its
-- identity or receipt evidence. The source amounts remain the recorded
-- payment evidence; base amounts are recalculated from the supplied rate.
create or replace function private.update_custom_expense(
  requested_expense_id uuid,
  expense_title text,
  expense_currency text,
  expense_total_minor bigint,
  payer_user_ids uuid[],
  payer_amounts bigint[],
  participant_user_ids uuid[],
  participant_amounts bigint[],
  expense_base_currency text,
  expense_base_amount_minor bigint,
  expense_exchange_rate numeric,
  expense_exchange_rate_source text default 'manual'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  requested_trip_id uuid;
  expense_creator_id uuid;
  trip_home_currency text;
  normalized_currency text := upper(expense_currency);
  normalized_base_currency text := upper(expense_base_currency);
  payer_count integer := cardinality(payer_user_ids);
  participant_count integer := cardinality(participant_user_ids);
  allocation_group_id uuid := gen_random_uuid();
begin
  if actor_user_id is null then raise exception 'Authentication required'; end if;

  select e.trip_id, e.created_by, t.home_currency
    into requested_trip_id, expense_creator_id, trip_home_currency
  from public.expenses e
  join public.trips t on t.id = e.trip_id
  where e.id = requested_expense_id
  for update;

  if requested_trip_id is null then raise exception 'Expense not found'; end if;
  if not private.is_trip_member(requested_trip_id) then raise exception 'Trip membership required'; end if;
  if not private.can_edit_trip(requested_trip_id)
     and expense_creator_id <> actor_user_id
     and not exists (
       select 1 from public.expense_payers ep
       where ep.expense_id = requested_expense_id and ep.user_id = actor_user_id
     )
  then
    raise exception 'Only the expense creator, payer, or a trip editor can edit this expense';
  end if;

  if char_length(trim(expense_title)) not between 1 and 180 then raise exception 'Expense title is required'; end if;
  if normalized_currency !~ '^[A-Z]{3}$' then raise exception 'Currency must be a three-letter ISO code'; end if;
  if expense_total_minor <= 0 then raise exception 'Expense total must be positive'; end if;
  if payer_count is null or payer_count = 0 or payer_count <> cardinality(payer_amounts) then raise exception 'Payer amounts are required'; end if;
  if participant_count is null or participant_count = 0 or participant_count <> cardinality(participant_amounts) then raise exception 'Participant shares are required'; end if;
  if payer_count <> (select count(distinct user_id) from unnest(payer_user_ids) as payer(user_id)) then raise exception 'Payers must be unique'; end if;
  if participant_count <> (select count(distinct user_id) from unnest(participant_user_ids) as participant(user_id)) then raise exception 'Participants must be unique'; end if;
  if exists (select 1 from unnest(payer_amounts) as payer_amount(amount) where amount < 0) then raise exception 'Payer amounts must be non-negative'; end if;
  if exists (select 1 from unnest(participant_amounts) as share_amount(amount) where amount < 0) then raise exception 'Participant shares must be non-negative'; end if;
  if (select coalesce(sum(amount), 0) from unnest(payer_amounts) as payer_amount(amount)) <> expense_total_minor then raise exception 'Payer amounts must equal the expense total'; end if;
  if (select coalesce(sum(amount), 0) from unnest(participant_amounts) as share_amount(amount)) <> expense_total_minor then raise exception 'Participant shares must equal the expense total'; end if;
  if exists (select 1 from unnest(payer_user_ids) as payer(user_id) where not private.is_user_trip_member(requested_trip_id, payer.user_id)) then raise exception 'Every payer must be a trip member'; end if;
  if exists (select 1 from unnest(participant_user_ids) as participant(user_id) where not private.is_user_trip_member(requested_trip_id, participant.user_id)) then raise exception 'Every participant must be a trip member'; end if;

  if normalized_base_currency <> trip_home_currency then raise exception 'Base currency must match the trip home currency'; end if;
  if expense_base_amount_minor is null or expense_base_amount_minor <= 0 then raise exception 'Base amount must be positive'; end if;
  if expense_exchange_rate is null or expense_exchange_rate <= 0 then raise exception 'Exchange rate must be positive'; end if;
  if normalized_currency = normalized_base_currency
     and (expense_base_amount_minor <> expense_total_minor or expense_exchange_rate <> 1)
  then
    raise exception 'Same-currency expenses must use a 1:1 conversion';
  end if;
  if expense_exchange_rate_source is null or char_length(trim(expense_exchange_rate_source)) = 0 then raise exception 'Exchange-rate source is required'; end if;

  update public.expenses
  set title = trim(expense_title),
      currency = normalized_currency,
      total_minor = expense_total_minor,
      base_currency = normalized_base_currency,
      base_amount_minor = expense_base_amount_minor,
      exchange_rate = expense_exchange_rate,
      exchange_rate_source = trim(expense_exchange_rate_source),
      version = version + 1,
      updated_at = now()
  where id = requested_expense_id;

  delete from public.expense_payers where expense_id = requested_expense_id;
  delete from public.expense_allocation_groups where expense_id = requested_expense_id;

  insert into public.expense_payers (expense_id, user_id, amount_minor, base_amount_minor)
  with raw as (
    select payer.user_id, payer.amount, payer.position,
      floor(payer.amount::numeric * expense_base_amount_minor / expense_total_minor)::bigint as base_floor,
      (payer.amount::numeric * expense_base_amount_minor / expense_total_minor)
        - floor(payer.amount::numeric * expense_base_amount_minor / expense_total_minor) as fraction
    from unnest(payer_user_ids, payer_amounts) with ordinality as payer(user_id, amount, position)
  ), ranked as (
    select raw.*,
      row_number() over (order by fraction desc, position) - 1 as remainder_position,
      expense_base_amount_minor - sum(base_floor) over () as remainder_count
    from raw
  )
  select requested_expense_id, user_id, amount,
    base_floor + case when remainder_position < remainder_count then 1 else 0 end
  from ranked;

  insert into public.expense_allocation_groups (id, expense_id, label, amount_minor)
  values (allocation_group_id, requested_expense_id, 'Custom split', expense_total_minor);

  insert into public.expense_shares (allocation_group_id, user_id, amount_minor, base_amount_minor)
  with raw as (
    select participant.user_id, participant.amount, participant.position,
      floor(participant.amount::numeric * expense_base_amount_minor / expense_total_minor)::bigint as base_floor,
      (participant.amount::numeric * expense_base_amount_minor / expense_total_minor)
        - floor(participant.amount::numeric * expense_base_amount_minor / expense_total_minor) as fraction
    from unnest(participant_user_ids, participant_amounts) with ordinality as participant(user_id, amount, position)
  ), ranked as (
    select raw.*,
      row_number() over (order by fraction desc, position) - 1 as remainder_position,
      expense_base_amount_minor - sum(base_floor) over () as remainder_count
    from raw
  )
  select allocation_group_id, user_id, amount,
    base_floor + case when remainder_position < remainder_count then 1 else 0 end
  from ranked;

  return requested_expense_id;
end;
$$;

create or replace function public.update_custom_expense(
  requested_expense_id uuid,
  expense_title text,
  expense_currency text,
  expense_total_minor bigint,
  payer_user_ids uuid[],
  payer_amounts bigint[],
  participant_user_ids uuid[],
  participant_amounts bigint[],
  expense_base_currency text,
  expense_base_amount_minor bigint,
  expense_exchange_rate numeric,
  expense_exchange_rate_source text default 'manual'
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.update_custom_expense(
    requested_expense_id,
    expense_title,
    expense_currency,
    expense_total_minor,
    payer_user_ids,
    payer_amounts,
    participant_user_ids,
    participant_amounts,
    expense_base_currency,
    expense_base_amount_minor,
    expense_exchange_rate,
    expense_exchange_rate_source
  );
$$;

revoke all on function private.update_custom_expense(uuid, text, text, bigint, uuid[], bigint[], uuid[], bigint[], text, bigint, numeric, text) from public, anon;
grant execute on function private.update_custom_expense(uuid, text, text, bigint, uuid[], bigint[], uuid[], bigint[], text, bigint, numeric, text) to authenticated;
revoke all on function public.update_custom_expense(uuid, text, text, bigint, uuid[], bigint[], uuid[], bigint[], text, bigint, numeric, text) from public, anon;
grant execute on function public.update_custom_expense(uuid, text, text, bigint, uuid[], bigint[], uuid[], bigint[], text, bigint, numeric, text) to authenticated;
