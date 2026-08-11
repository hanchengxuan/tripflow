drop policy if exists "users upload receipt files to their own folder" on storage.objects;

create policy "users upload receipt files for authorized expenses"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'expense-receipts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.expenses e
    where e.id::text = (storage.foldername(name))[2]
      and (
        (e.segment_id is null and public.is_trip_member(e.trip_id))
        or (e.segment_id is not null and public.can_read_segment(e.segment_id))
      )
  )
);

create or replace function private.record_settlement(
  requested_trip_id uuid,
  recipient_user_id uuid,
  settlement_currency text,
  settlement_amount_minor bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  sender_user_id uuid := (select auth.uid());
  normalized_currency text := upper(settlement_currency);
  sender_balance bigint;
  recipient_balance bigint;
  created_settlement_id uuid;
begin
  if sender_user_id is null then raise exception 'Authentication required'; end if;
  if sender_user_id = recipient_user_id then raise exception 'Sender and recipient must differ'; end if;
  if normalized_currency !~ '^[A-Z]{3}$' then raise exception 'Currency must be a three-letter ISO code'; end if;
  if settlement_amount_minor <= 0 then raise exception 'Settlement amount must be positive'; end if;
  if not public.is_user_trip_member(requested_trip_id, sender_user_id)
    or not public.is_user_trip_member(requested_trip_id, recipient_user_id)
  then raise exception 'Both settlement participants must be trip members'; end if;

  -- Serialize settlement validation and insertion for one trip/currency. Without
  -- this lock, two requests can both validate against the same stale balance.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(requested_trip_id::text || ':' || normalized_currency, 0)
  );

  sender_balance := private.member_currency_balance(
    requested_trip_id,
    sender_user_id,
    normalized_currency
  );
  recipient_balance := private.member_currency_balance(
    requested_trip_id,
    recipient_user_id,
    normalized_currency
  );

  if sender_balance >= 0 then raise exception 'Sender has no outstanding amount to pay'; end if;
  if recipient_balance <= 0 then raise exception 'Recipient has no outstanding amount to receive'; end if;
  if settlement_amount_minor > least(-sender_balance, recipient_balance) then
    raise exception 'Settlement amount exceeds the outstanding balance';
  end if;

  insert into public.settlements (
    trip_id, from_user_id, to_user_id, currency, amount_minor, settled_at, recorded_by
  ) values (
    requested_trip_id,
    sender_user_id,
    recipient_user_id,
    normalized_currency,
    settlement_amount_minor,
    now(),
    sender_user_id
  )
  returning id into created_settlement_id;

  return created_settlement_id;
end;
$$;

revoke all on function private.record_settlement(uuid, uuid, text, bigint) from public, anon;
grant execute on function private.record_settlement(uuid, uuid, text, bigint) to authenticated;
