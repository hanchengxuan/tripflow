-- Add an atomic custom-expense RPC for multiple payers and non-equal shares.
-- Source-currency amounts remain the immutable evidence; base amounts are
-- allocated proportionally with deterministic remainder handling so the
-- normalized ledger still balances exactly after conversion.
alter table public.expenses
  add column if not exists client_mutation_id text;

alter table public.expenses
  add constraint expenses_client_mutation_id_check
  check (client_mutation_id is null or char_length(client_mutation_id) between 1 and 180);

create unique index if not exists expenses_client_mutation_unique_idx
  on public.expenses (trip_id, created_by, client_mutation_id)
  where client_mutation_id is not null;

drop function if exists public.create_custom_expense(
  uuid, text, text, bigint, uuid[], bigint[], uuid[], bigint[],
  public.expense_source, timestamptz, uuid, text, text, bigint, numeric, text
);

create or replace function public.create_custom_expense(
  requested_trip_id uuid,
  expense_title text,
  expense_currency text,
  expense_total_minor bigint,
  payer_user_ids uuid[],
  payer_amounts bigint[],
  participant_user_ids uuid[],
  participant_amounts bigint[],
  requested_source public.expense_source default 'manual',
  expense_occurred_at timestamptz default now(),
  requested_segment_id uuid default null,
  requested_mutation_id text default null,
  expense_base_currency text default null,
  expense_base_amount_minor bigint default null,
  expense_exchange_rate numeric default null,
  expense_exchange_rate_source text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  created_expense_id uuid;
  allocation_group_id uuid := gen_random_uuid();
  payer_count integer := cardinality(payer_user_ids);
  participant_count integer := cardinality(participant_user_ids);
  trip_home_currency text;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if not public.is_trip_member(requested_trip_id) then raise exception 'Trip membership required'; end if;
  select home_currency into trip_home_currency from public.trips where id = requested_trip_id;
  if trip_home_currency is null then raise exception 'Trip not found'; end if;
  if char_length(trim(expense_title)) not between 1 and 180 then raise exception 'Expense title is required'; end if;
  if upper(expense_currency) !~ '^[A-Z]{3}$' then raise exception 'Currency must be a three-letter ISO code'; end if;
  if expense_total_minor <= 0 then raise exception 'Expense total must be positive'; end if;
  if payer_count is null or payer_count = 0 or payer_count <> cardinality(payer_amounts) then raise exception 'Payer amounts are required'; end if;
  if participant_count is null or participant_count = 0 or participant_count <> cardinality(participant_amounts) then raise exception 'Participant shares are required'; end if;
  if payer_count <> (select count(distinct user_id) from unnest(payer_user_ids) as payer(user_id)) then raise exception 'Payers must be unique'; end if;
  if participant_count <> (select count(distinct user_id) from unnest(participant_user_ids) as participant(user_id)) then raise exception 'Participants must be unique'; end if;
  if exists (select 1 from unnest(payer_amounts) as payer_amount(amount) where amount < 0) then raise exception 'Payer amounts must be non-negative'; end if;
  if exists (select 1 from unnest(participant_amounts) as share_amount(amount) where amount < 0) then raise exception 'Participant shares must be non-negative'; end if;
  if (select coalesce(sum(amount), 0) from unnest(payer_amounts) as payer_amount(amount)) <> expense_total_minor then raise exception 'Payer amounts must equal the expense total'; end if;
  if (select coalesce(sum(amount), 0) from unnest(participant_amounts) as share_amount(amount)) <> expense_total_minor then raise exception 'Participant shares must equal the expense total'; end if;
  if exists (select 1 from unnest(payer_user_ids) as payer(user_id) where not public.is_user_trip_member(requested_trip_id, payer.user_id)) then raise exception 'Every payer must be a trip member'; end if;
  if exists (select 1 from unnest(participant_user_ids) as participant(user_id) where not public.is_user_trip_member(requested_trip_id, participant.user_id)) then raise exception 'Every participant must be a trip member'; end if;
  if requested_segment_id is not null and not public.can_read_segment(requested_segment_id) then raise exception 'Segment access required'; end if;

  if expense_base_currency is null then
    if upper(expense_currency) <> trip_home_currency then raise exception 'Base-currency conversion is required'; end if;
    expense_base_currency := trip_home_currency;
    expense_base_amount_minor := expense_total_minor;
    expense_exchange_rate := 1;
    expense_exchange_rate_source := 'same-currency-default';
  end if;
  if upper(expense_base_currency) <> trip_home_currency then raise exception 'Base currency must match the trip home currency'; end if;
  if expense_base_amount_minor is null or expense_base_amount_minor <= 0 then raise exception 'Base amount must be positive'; end if;
  if expense_exchange_rate is null or expense_exchange_rate <= 0 then raise exception 'Exchange rate must be positive'; end if;
  if upper(expense_currency) = upper(expense_base_currency)
    and (expense_base_amount_minor <> expense_total_minor or expense_exchange_rate <> 1)
  then
    raise exception 'Same-currency expenses must use a 1:1 conversion';
  end if;
  if expense_exchange_rate_source is null or char_length(trim(expense_exchange_rate_source)) = 0 then raise exception 'Exchange-rate source is required'; end if;

  if requested_mutation_id is not null then
    select id into created_expense_id
    from public.expenses
    where trip_id = requested_trip_id and created_by = current_user_id and client_mutation_id = requested_mutation_id;
    if created_expense_id is not null then return created_expense_id; end if;
  end if;

  created_expense_id := gen_random_uuid();
  insert into public.expenses (
    id, trip_id, segment_id, created_by, title, currency, total_minor,
    base_currency, base_amount_minor, exchange_rate, exchange_rate_source,
    occurred_at, source, client_mutation_id
  ) values (
    created_expense_id, requested_trip_id, requested_segment_id, current_user_id,
    trim(expense_title), upper(expense_currency), expense_total_minor,
    upper(expense_base_currency), expense_base_amount_minor, expense_exchange_rate,
    trim(expense_exchange_rate_source), expense_occurred_at, requested_source,
    requested_mutation_id
  )
  on conflict (trip_id, created_by, client_mutation_id)
    where client_mutation_id is not null
    do nothing;

  if not exists (select 1 from public.expenses where id = created_expense_id) and requested_mutation_id is not null then
    select id into created_expense_id
    from public.expenses
    where trip_id = requested_trip_id and created_by = current_user_id and client_mutation_id = requested_mutation_id;
    if created_expense_id is not null then return created_expense_id; end if;
  end if;

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
  select created_expense_id, user_id, amount,
    base_floor + case when remainder_position < remainder_count then 1 else 0 end
  from ranked;

  insert into public.expense_allocation_groups (id, expense_id, label, amount_minor)
  values (allocation_group_id, created_expense_id, 'Custom split', expense_total_minor);

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

  return created_expense_id;
end;
$$;

revoke all on function public.create_custom_expense(
  uuid, text, text, bigint, uuid[], bigint[], uuid[], bigint[],
  public.expense_source, timestamptz, uuid, text, text, bigint, numeric, text
) from public, anon;
grant execute on function public.create_custom_expense(
  uuid, text, text, bigint, uuid[], bigint[], uuid[], bigint[],
  public.expense_source, timestamptz, uuid, text, text, bigint, numeric, text
) to authenticated;
