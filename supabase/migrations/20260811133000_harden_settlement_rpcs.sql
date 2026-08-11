create index expense_receipts_uploaded_by_idx
  on public.expense_receipts (uploaded_by);

alter function public.record_settlement(uuid, uuid, text, bigint)
  set schema private;
alter function public.unrecord_settlement(uuid)
  set schema private;

create function public.record_settlement(
  requested_trip_id uuid,
  recipient_user_id uuid,
  settlement_currency text,
  settlement_amount_minor bigint
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.record_settlement(
    requested_trip_id,
    recipient_user_id,
    settlement_currency,
    settlement_amount_minor
  );
$$;

create function public.unrecord_settlement(requested_settlement_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.unrecord_settlement(requested_settlement_id);
$$;

revoke all on function private.record_settlement(uuid, uuid, text, bigint) from public, anon;
revoke all on function private.unrecord_settlement(uuid) from public, anon;
grant execute on function private.record_settlement(uuid, uuid, text, bigint) to authenticated;
grant execute on function private.unrecord_settlement(uuid) to authenticated;

revoke all on function public.record_settlement(uuid, uuid, text, bigint) from public, anon;
revoke all on function public.unrecord_settlement(uuid) from public, anon;
grant execute on function public.record_settlement(uuid, uuid, text, bigint) to authenticated;
grant execute on function public.unrecord_settlement(uuid) to authenticated;
