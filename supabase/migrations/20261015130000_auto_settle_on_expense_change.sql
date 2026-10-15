-- Automatic settlement used to re-run only when a transfer was recorded, so an
-- expense that needs no transfer (paid by and for the same traveller) stayed
-- unsettled. Re-run it after any change to an expense, its payers or its
-- shares. The triggers are deferred so the check sees the finished expense,
-- and they ignore the settled_* columns the check itself writes.
create function private.refresh_settlement_after_ledger_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  affected_trip_ids uuid[];
  affected_trip_id uuid;
begin
  if tg_table_name = 'expenses' then
    affected_trip_ids := array[old.trip_id, new.trip_id];
  elsif tg_table_name = 'expense_payers' then
    select array_agg(trip_id) into affected_trip_ids from public.expenses where id in (old.expense_id, new.expense_id);
  else
    select array_agg(e.trip_id) into affected_trip_ids
    from public.expense_allocation_groups g join public.expenses e on e.id = g.expense_id
    where g.id in (old.allocation_group_id, new.allocation_group_id);
  end if;

  for affected_trip_id in select distinct trip_id from unnest(affected_trip_ids) as trip_id where trip_id is not null loop
    perform private.refresh_expense_settlement_flags(affected_trip_id, (select auth.uid()));
  end loop;
  return null;
end;
$$;
revoke all on function private.refresh_settlement_after_ledger_change() from public, anon, authenticated;

create constraint trigger expenses_refresh_settlement
after insert or delete or update of trip_id, currency, total_minor, base_currency, base_amount_minor, exchange_rate on public.expenses
deferrable initially deferred
for each row execute function private.refresh_settlement_after_ledger_change();

create constraint trigger expense_payers_refresh_settlement
after insert or update or delete on public.expense_payers
deferrable initially deferred
for each row execute function private.refresh_settlement_after_ledger_change();

create constraint trigger expense_shares_refresh_settlement
after insert or update or delete on public.expense_shares
deferrable initially deferred
for each row execute function private.refresh_settlement_after_ledger_change();

-- Settle ledgers that are already balanced but were never re-checked.
select private.refresh_expense_settlement_flags(id, null) from public.trips;
