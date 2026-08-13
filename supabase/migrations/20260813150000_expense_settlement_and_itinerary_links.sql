-- Give each expense an explicit settlement state and an optional link back to
-- the itinerary item it reviews. Settlement rows remain the source of truth
-- for balances; these fields make the per-expense state visible and editable.
alter table public.itinerary_items
  add constraint itinerary_items_id_trip_unique unique (id, trip_id);

alter table public.expenses
  add column itinerary_item_id uuid references public.itinerary_items(id) on delete set null,
  add column settled_at timestamptz,
  add column settled_by uuid references public.profiles(id) on delete set null,
  add column settlement_source text,
  add constraint expenses_itinerary_item_same_trip_fk
    foreign key (itinerary_item_id, trip_id) references public.itinerary_items (id, trip_id),
  add constraint expenses_settlement_source_check
    check (settlement_source is null or settlement_source in ('manual', 'automatic')),
  add constraint expenses_settlement_state_check
    check (
      (settled_at is null and settlement_source is null)
      or (settled_at is not null and settlement_source is not null)
    );

create index expenses_itinerary_item_idx on public.expenses (itinerary_item_id)
where itinerary_item_id is not null;

-- Editing the amount, currency, payers, or shares invalidates a previous
-- settlement mark. Updating only the settlement metadata does not.
create or replace function private.reset_expense_settlement_on_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.title is distinct from new.title
    or old.currency is distinct from new.currency
    or old.total_minor is distinct from new.total_minor
    or old.base_currency is distinct from new.base_currency
    or old.base_amount_minor is distinct from new.base_amount_minor
    or old.exchange_rate is distinct from new.exchange_rate
    or old.exchange_rate_source is distinct from new.exchange_rate_source
  then
    new.settled_at := null;
    new.settled_by := null;
    new.settlement_source := null;
  end if;
  return new;
end;
$$;

drop trigger if exists expenses_reset_settlement_on_edit on public.expenses;
create trigger expenses_reset_settlement_on_edit
before update on public.expenses
for each row execute function private.reset_expense_settlement_on_edit();

create or replace function private.set_expense_itinerary_item(
  requested_expense_id uuid,
  requested_itinerary_item_id uuid
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
begin
  if actor_user_id is null then raise exception 'Authentication required'; end if;

  select e.trip_id, e.created_by
    into requested_trip_id, expense_creator_id
  from public.expenses e
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
    raise exception 'Only the expense creator, payer, or a trip editor can link this expense';
  end if;

  if requested_itinerary_item_id is not null
     and not exists (
       select 1
       from public.itinerary_items item
       where item.id = requested_itinerary_item_id
         and item.trip_id = requested_trip_id
     )
  then
    raise exception 'Itinerary item must belong to the same trip';
  end if;

  update public.expenses
  set itinerary_item_id = requested_itinerary_item_id,
      updated_at = now()
  where id = requested_expense_id;

  return requested_expense_id;
end;
$$;

create or replace function public.set_expense_itinerary_item(
  requested_expense_id uuid,
  requested_itinerary_item_id uuid
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.set_expense_itinerary_item(requested_expense_id, requested_itinerary_item_id);
$$;

revoke all on function private.set_expense_itinerary_item(uuid, uuid) from public, anon;
grant execute on function private.set_expense_itinerary_item(uuid, uuid) to authenticated;
revoke all on function public.set_expense_itinerary_item(uuid, uuid) from public, anon;
grant execute on function public.set_expense_itinerary_item(uuid, uuid) to authenticated;

create or replace function private.set_expense_settled(
  requested_expense_id uuid,
  requested_settled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  requested_trip_id uuid;
  expense_creator_id uuid;
begin
  if actor_user_id is null then raise exception 'Authentication required'; end if;

  select e.trip_id, e.created_by
    into requested_trip_id, expense_creator_id
  from public.expenses e
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
    raise exception 'Only the expense creator, payer, or a trip editor can change settlement state';
  end if;

  if coalesce(requested_settled, false) then
    update public.expenses
    set settled_at = now(),
        settled_by = actor_user_id,
        settlement_source = 'manual',
        updated_at = now()
    where id = requested_expense_id;
  else
    update public.expenses
    set settled_at = null,
        settled_by = null,
        settlement_source = null,
        updated_at = now()
    where id = requested_expense_id;
  end if;
end;
$$;

create or replace function public.set_expense_settled(
  requested_expense_id uuid,
  requested_settled boolean
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.set_expense_settled(requested_expense_id, requested_settled);
$$;

revoke all on function private.set_expense_settled(uuid, boolean) from public, anon;
grant execute on function private.set_expense_settled(uuid, boolean) to authenticated;
revoke all on function public.set_expense_settled(uuid, boolean) from public, anon;
grant execute on function public.set_expense_settled(uuid, boolean) to authenticated;

-- Keep automatic state in sync with the normalized ledger. A legacy expense
-- without a conversion is deliberately not auto-settled until its base amount
-- is known.
create or replace function private.refresh_expense_settlement_flags(
  requested_trip_id uuid,
  requesting_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  trip_home_currency text;
  has_outstanding boolean;
begin
  select home_currency into trip_home_currency
  from public.trips
  where id = requested_trip_id;
  if trip_home_currency is null then return; end if;

  if exists (
    select 1 from public.expenses e
    where e.trip_id = requested_trip_id
      and (e.base_currency is null or e.base_amount_minor is null or e.exchange_rate is null)
  ) then
    has_outstanding := true;
  else
    with people as (
      select ep.user_id
      from public.expense_payers ep
      join public.expenses e on e.id = ep.expense_id
      where e.trip_id = requested_trip_id
      union
      select es.user_id
      from public.expense_shares es
      join public.expense_allocation_groups eag on eag.id = es.allocation_group_id
      join public.expenses e on e.id = eag.expense_id
      where e.trip_id = requested_trip_id
      union
      select s.from_user_id from public.settlements s where s.trip_id = requested_trip_id
      union
      select s.to_user_id from public.settlements s where s.trip_id = requested_trip_id
    )
    select exists (
      select 1 from people
      where private.member_base_currency_balance(requested_trip_id, people.user_id, trip_home_currency) <> 0
    ) into has_outstanding;
  end if;

  if has_outstanding then
    update public.expenses
    set settled_at = null,
        settled_by = null,
        settlement_source = null,
        updated_at = now()
    where trip_id = requested_trip_id
      and settlement_source = 'automatic';
  else
    update public.expenses e
    set settled_at = now(),
        settled_by = coalesce(requesting_user_id, e.created_by),
        settlement_source = 'automatic',
        updated_at = now()
    where e.trip_id = requested_trip_id
      and e.settled_at is null;
  end if;
end;
$$;

create or replace function private.refresh_expense_settlement_flags_on_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_expense_settlement_flags(
    coalesce(new.trip_id, old.trip_id),
    (select auth.uid())
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists settlements_refresh_expense_state on public.settlements;
create trigger settlements_refresh_expense_state
after insert or delete on public.settlements
for each row execute function private.refresh_expense_settlement_flags_on_change();

revoke all on function private.refresh_expense_settlement_flags(uuid, uuid) from public, anon, authenticated;
revoke all on function private.refresh_expense_settlement_flags_on_change() from public, anon, authenticated;
