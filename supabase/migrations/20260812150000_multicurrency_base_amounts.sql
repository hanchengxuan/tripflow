-- Keep the amount a traveller actually paid while recording the confirmed
-- amount used by the trip ledger. The base amount is never inferred for a
-- cross-currency legacy row; a traveller must provide the real rate.
alter table public.expenses
  add column if not exists base_currency text,
  add column if not exists base_amount_minor bigint,
  add column if not exists exchange_rate numeric(24, 12),
  add column if not exists exchange_rate_source text;

alter table public.expense_payers
  add column if not exists base_amount_minor bigint;

alter table public.expense_shares
  add column if not exists base_amount_minor bigint;

alter table public.settlements
  add column if not exists base_currency text,
  add column if not exists base_amount_minor bigint,
  add column if not exists exchange_rate numeric(24, 12),
  add column if not exists exchange_rate_source text;

alter table public.expenses
  add constraint expenses_base_currency_check check (base_currency is null or base_currency ~ '^[A-Z]{3}$'),
  add constraint expenses_base_amount_check check (base_amount_minor is null or base_amount_minor > 0),
  add constraint expenses_exchange_rate_check check (exchange_rate is null or exchange_rate > 0),
  add constraint expenses_conversion_fields_check check (
    (base_currency is null and base_amount_minor is null and exchange_rate is null)
    or (base_currency is not null and base_amount_minor is not null and exchange_rate is not null)
  );

alter table public.settlements
  add constraint settlements_base_currency_check check (base_currency is null or base_currency ~ '^[A-Z]{3}$'),
  add constraint settlements_base_amount_check check (base_amount_minor is null or base_amount_minor > 0),
  add constraint settlements_exchange_rate_check check (exchange_rate is null or exchange_rate > 0),
  add constraint settlements_conversion_fields_check check (
    (base_currency is null and base_amount_minor is null and exchange_rate is null)
    or (base_currency is not null and base_amount_minor is not null and exchange_rate is not null)
  );

-- Same-currency legacy rows are lossless to backfill. Cross-currency rows stay
-- visible in source currency until a real rate is recorded by a traveller.
update public.expenses e
set base_currency = t.home_currency,
    base_amount_minor = e.total_minor,
    exchange_rate = 1,
    exchange_rate_source = 'same-currency-backfill'
from public.trips t
where e.trip_id = t.id
  and e.currency = t.home_currency
  and e.base_currency is null;

update public.expense_payers ep
set base_amount_minor = ep.amount_minor
from public.expenses e
join public.trips t on t.id = e.trip_id
where ep.expense_id = e.id
  and e.currency = t.home_currency
  and ep.base_amount_minor is null;

update public.expense_shares es
set base_amount_minor = es.amount_minor
from public.expense_allocation_groups eag
join public.expenses e on e.id = eag.expense_id
join public.trips t on t.id = e.trip_id
where es.allocation_group_id = eag.id
  and e.currency = t.home_currency
  and es.base_amount_minor is null;

update public.settlements s
set base_currency = t.home_currency,
    base_amount_minor = s.amount_minor,
    exchange_rate = 1,
    exchange_rate_source = 'same-currency-backfill'
from public.trips t
where s.trip_id = t.id
  and s.currency = t.home_currency
  and s.base_currency is null;

create or replace function public.create_equal_expense(
  requested_trip_id uuid,
  expense_title text,
  expense_currency text,
  expense_total_minor bigint,
  payer_user_id uuid,
  participant_user_ids uuid[],
  expense_occurred_at timestamptz default now(),
  requested_segment_id uuid default null,
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
  trip_base_currency text := (select home_currency from public.trips where id = requested_trip_id);
  normalized_currency text := upper(expense_currency);
  normalized_base_currency text := upper(coalesce(expense_base_currency, trip_base_currency));
  normalized_rate numeric := coalesce(expense_exchange_rate, 1);
  normalized_base_amount bigint := coalesce(expense_base_amount_minor, expense_total_minor);
  created_expense_id uuid := gen_random_uuid();
  allocation_group_id uuid := gen_random_uuid();
  participant_count integer := cardinality(participant_user_ids);
  base_share bigint;
  base_remainder bigint;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if not public.is_trip_member(requested_trip_id) then raise exception 'Trip membership required'; end if;
  if char_length(trim(expense_title)) not between 1 and 180 then raise exception 'Expense title is required'; end if;
  if normalized_currency !~ '^[A-Z]{3}$' then raise exception 'Currency must be a three-letter ISO code'; end if;
  if normalized_base_currency !~ '^[A-Z]{3}$' or normalized_base_currency <> trip_base_currency then raise exception 'Base currency must match the trip home currency'; end if;
  if expense_total_minor <= 0 or normalized_base_amount <= 0 then raise exception 'Expense amounts must be positive'; end if;
  if normalized_rate <= 0 then raise exception 'Exchange rate must be positive'; end if;
  if normalized_currency = normalized_base_currency and (normalized_base_amount <> expense_total_minor or normalized_rate <> 1) then raise exception 'Same-currency expenses must use a 1:1 conversion'; end if;
  if participant_count is null or participant_count = 0 then raise exception 'At least one participant is required'; end if;
  if participant_count <> (select count(distinct participant.user_id) from unnest(participant_user_ids) as participant(user_id)) then raise exception 'Participants must be unique'; end if;
  if not public.is_user_trip_member(requested_trip_id, payer_user_id) then raise exception 'Payer must be a trip member'; end if;
  if exists (select 1 from unnest(participant_user_ids) as participant(user_id) where not public.is_user_trip_member(requested_trip_id, participant.user_id)) then raise exception 'Every participant must be a trip member'; end if;
  if requested_segment_id is not null and not public.can_read_segment(requested_segment_id) then raise exception 'Segment access required'; end if;

  insert into public.expenses (
    id, trip_id, segment_id, created_by, title, currency, total_minor, occurred_at, source,
    base_currency, base_amount_minor, exchange_rate, exchange_rate_source
  ) values (
    created_expense_id, requested_trip_id, requested_segment_id, current_user_id, trim(expense_title), normalized_currency,
    expense_total_minor, expense_occurred_at, 'manual', normalized_base_currency, normalized_base_amount, normalized_rate,
    coalesce(expense_exchange_rate_source, 'manual')
  );

  insert into public.expense_payers (expense_id, user_id, amount_minor, base_amount_minor)
  values (created_expense_id, payer_user_id, expense_total_minor, normalized_base_amount);

  insert into public.expense_allocation_groups (id, expense_id, label, amount_minor)
  values (allocation_group_id, created_expense_id, 'Equal split', expense_total_minor);

  base_share := normalized_base_amount / participant_count;
  base_remainder := normalized_base_amount % participant_count;
  insert into public.expense_shares (allocation_group_id, user_id, amount_minor, base_amount_minor)
  select allocation_group_id, participant_id,
    expense_total_minor / participant_count + case when position <= expense_total_minor % participant_count then 1 else 0 end,
    base_share + case when position <= base_remainder then 1 else 0 end
  from unnest(participant_user_ids) with ordinality as participants(participant_id, position);

  return created_expense_id;
end;
$$;

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
    select coalesce(ep.base_amount_minor, case when e.currency = upper(requested_base_currency) then ep.amount_minor end) as effect
    from public.expense_payers ep
    join public.expenses e on e.id = ep.expense_id
    where e.trip_id = requested_trip_id and ep.user_id = target_user_id
      and (e.base_currency = upper(requested_base_currency) or e.currency = upper(requested_base_currency))
    union all
    select -coalesce(es.base_amount_minor, case when e.currency = upper(requested_base_currency) then es.amount_minor end)
    from public.expense_shares es
    join public.expense_allocation_groups eag on eag.id = es.allocation_group_id
    join public.expenses e on e.id = eag.expense_id
    where e.trip_id = requested_trip_id and es.user_id = target_user_id
      and (e.base_currency = upper(requested_base_currency) or e.currency = upper(requested_base_currency))
    union all
    select coalesce(s.base_amount_minor, case when s.currency = upper(requested_base_currency) then s.amount_minor end)
    from public.settlements s
    where s.trip_id = requested_trip_id and s.from_user_id = target_user_id
      and (s.base_currency = upper(requested_base_currency) or s.currency = upper(requested_base_currency))
    union all
    select -coalesce(s.base_amount_minor, case when s.currency = upper(requested_base_currency) then s.amount_minor end)
    from public.settlements s
    where s.trip_id = requested_trip_id and s.to_user_id = target_user_id
      and (s.base_currency = upper(requested_base_currency) or s.currency = upper(requested_base_currency))
  ) effects;
$$;

create or replace function private.record_settlement(
  requested_trip_id uuid,
  recipient_user_id uuid,
  settlement_currency text,
  settlement_amount_minor bigint,
  settlement_base_currency text,
  settlement_base_amount_minor bigint,
  settlement_exchange_rate numeric,
  settlement_exchange_rate_source text default 'manual'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  sender_user_id uuid := (select auth.uid());
  normalized_currency text := upper(settlement_currency);
  normalized_base_currency text := upper(settlement_base_currency);
  sender_balance bigint;
  recipient_balance bigint;
  created_settlement_id uuid;
begin
  if sender_user_id is null then raise exception 'Authentication required'; end if;
  if sender_user_id = recipient_user_id then raise exception 'Sender and recipient must differ'; end if;
  if normalized_currency !~ '^[A-Z]{3}$' or normalized_base_currency !~ '^[A-Z]{3}$' then raise exception 'Currency must be a three-letter ISO code'; end if;
  if settlement_amount_minor <= 0 or settlement_base_amount_minor <= 0 or settlement_exchange_rate <= 0 then raise exception 'Settlement amounts and exchange rate must be positive'; end if;
  if not public.is_user_trip_member(requested_trip_id, sender_user_id) or not public.is_user_trip_member(requested_trip_id, recipient_user_id) then raise exception 'Both settlement participants must be trip members'; end if;
  if normalized_base_currency <> (select home_currency from public.trips where id = requested_trip_id) then raise exception 'Base currency must match the trip home currency'; end if;
  if normalized_currency = normalized_base_currency and (settlement_base_amount_minor <> settlement_amount_minor or settlement_exchange_rate <> 1) then raise exception 'Same-currency settlements must use a 1:1 conversion'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(requested_trip_id::text || ':' || normalized_base_currency, 0));
  sender_balance := private.member_base_currency_balance(requested_trip_id, sender_user_id, normalized_base_currency);
  recipient_balance := private.member_base_currency_balance(requested_trip_id, recipient_user_id, normalized_base_currency);
  if sender_balance >= 0 then raise exception 'Sender has no outstanding amount to pay'; end if;
  if recipient_balance <= 0 then raise exception 'Recipient has no outstanding amount to receive'; end if;
  if settlement_base_amount_minor > least(-sender_balance, recipient_balance) then raise exception 'Settlement amount exceeds the outstanding balance'; end if;

  insert into public.settlements (
    trip_id, from_user_id, to_user_id, currency, amount_minor, settled_at, recorded_by,
    base_currency, base_amount_minor, exchange_rate, exchange_rate_source
  ) values (
    requested_trip_id, sender_user_id, recipient_user_id, normalized_currency, settlement_amount_minor, now(), sender_user_id,
    normalized_base_currency, settlement_base_amount_minor, settlement_exchange_rate, settlement_exchange_rate_source
  ) returning id into created_settlement_id;
  return created_settlement_id;
end;
$$;

create or replace function public.record_settlement(
  requested_trip_id uuid,
  recipient_user_id uuid,
  settlement_currency text,
  settlement_amount_minor bigint,
  settlement_base_currency text,
  settlement_base_amount_minor bigint,
  settlement_exchange_rate numeric,
  settlement_exchange_rate_source text default 'manual'
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.record_settlement(
    requested_trip_id, recipient_user_id, settlement_currency, settlement_amount_minor,
    settlement_base_currency, settlement_base_amount_minor, settlement_exchange_rate, settlement_exchange_rate_source
  );
$$;

grant execute on function public.create_equal_expense(uuid, text, text, bigint, uuid, uuid[], timestamptz, uuid, text, bigint, numeric, text) to authenticated;
grant execute on function private.member_base_currency_balance(uuid, uuid, text) to authenticated;
grant execute on function private.record_settlement(uuid, uuid, text, bigint, text, bigint, numeric, text) to authenticated;
grant execute on function public.record_settlement(uuid, uuid, text, bigint, text, bigint, numeric, text) to authenticated;
