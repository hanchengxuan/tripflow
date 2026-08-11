create table public.expense_receipts (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_at timestamptz not null default now()
);

create index expense_receipts_expense_created_idx
  on public.expense_receipts (expense_id, created_at);

alter table public.expense_receipts enable row level security;

grant select, insert, delete on public.expense_receipts to authenticated;

create policy expense_receipts_read_authorized
on public.expense_receipts for select to authenticated
using (exists (
  select 1
  from public.expenses e
  where e.id = expense_id
    and (
      (e.segment_id is null and public.is_trip_member(e.trip_id))
      or (e.segment_id is not null and public.can_read_segment(e.segment_id))
    )
));

create policy expense_receipts_insert_authorized
on public.expense_receipts for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and exists (
    select 1
    from public.expenses e
    where e.id = expense_id
      and (
        (e.segment_id is null and public.is_trip_member(e.trip_id))
        or (e.segment_id is not null and public.can_read_segment(e.segment_id))
      )
  )
);

create policy expense_receipts_delete_authorized
on public.expense_receipts for delete to authenticated
using (
  uploaded_by = (select auth.uid())
  or exists (
    select 1
    from public.expenses e
    where e.id = expense_id and public.can_edit_trip(e.trip_id)
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expense-receipts',
  'expense-receipts',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "members read authorized expense receipts"
on storage.objects for select to authenticated
using (
  bucket_id = 'expense-receipts'
  and exists (
    select 1
    from public.expense_receipts r
    join public.expenses e on e.id = r.expense_id
    where r.storage_path = name
      and (
        (e.segment_id is null and public.is_trip_member(e.trip_id))
        or (e.segment_id is not null and public.can_read_segment(e.segment_id))
      )
  )
);

create policy "users upload receipt files to their own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'expense-receipts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "users delete authorized receipt files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'expense-receipts'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (
      select 1
      from public.expense_receipts r
      join public.expenses e on e.id = r.expense_id
      where r.storage_path = name and public.can_edit_trip(e.trip_id)
    )
  )
);

drop policy if exists settlements_insert_participants on public.settlements;

create policy settlements_insert_sender
on public.settlements for insert to authenticated
with check (
  public.is_trip_member(trip_id)
  and recorded_by = (select auth.uid())
  and from_user_id = (select auth.uid())
  and public.is_user_trip_member(trip_id, from_user_id)
  and public.is_user_trip_member(trip_id, to_user_id)
);

create policy settlements_delete_sender
on public.settlements for delete to authenticated
using (from_user_id = (select auth.uid()));

grant delete on public.settlements to authenticated;

create or replace function private.member_currency_balance(
  requested_trip_id uuid,
  requested_user_id uuid,
  requested_currency text
)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  with expense_effect as (
    select coalesce(sum(effect), 0)::bigint as amount
    from (
      select ep.amount_minor as effect
      from public.expense_payers ep
      join public.expenses e on e.id = ep.expense_id
      where e.trip_id = requested_trip_id
        and e.currency = upper(requested_currency)
        and ep.user_id = requested_user_id
      union all
      select -es.amount_minor as effect
      from public.expense_shares es
      join public.expense_allocation_groups eag on eag.id = es.allocation_group_id
      join public.expenses e on e.id = eag.expense_id
      where e.trip_id = requested_trip_id
        and e.currency = upper(requested_currency)
        and es.user_id = requested_user_id
    ) effects
  ), settlement_effect as (
    select coalesce(sum(effect), 0)::bigint as amount
    from (
      select s.amount_minor as effect
      from public.settlements s
      where s.trip_id = requested_trip_id
        and s.currency = upper(requested_currency)
        and s.from_user_id = requested_user_id
      union all
      select -s.amount_minor as effect
      from public.settlements s
      where s.trip_id = requested_trip_id
        and s.currency = upper(requested_currency)
        and s.to_user_id = requested_user_id
    ) effects
  )
  select expense_effect.amount + settlement_effect.amount
  from expense_effect, settlement_effect;
$$;

create or replace function public.record_settlement(
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
  sender_balance bigint;
  recipient_balance bigint;
  created_settlement_id uuid;
begin
  if sender_user_id is null then raise exception 'Authentication required'; end if;
  if sender_user_id = recipient_user_id then raise exception 'Sender and recipient must differ'; end if;
  if upper(settlement_currency) !~ '^[A-Z]{3}$' then raise exception 'Currency must be a three-letter ISO code'; end if;
  if settlement_amount_minor <= 0 then raise exception 'Settlement amount must be positive'; end if;
  if not public.is_user_trip_member(requested_trip_id, sender_user_id)
    or not public.is_user_trip_member(requested_trip_id, recipient_user_id)
  then raise exception 'Both settlement participants must be trip members'; end if;

  sender_balance := private.member_currency_balance(requested_trip_id, sender_user_id, settlement_currency);
  recipient_balance := private.member_currency_balance(requested_trip_id, recipient_user_id, settlement_currency);

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
    upper(settlement_currency),
    settlement_amount_minor,
    now(),
    sender_user_id
  )
  returning id into created_settlement_id;

  return created_settlement_id;
end;
$$;

create or replace function public.unrecord_settlement(requested_settlement_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.settlements
  where id = requested_settlement_id
    and from_user_id = (select auth.uid());

  if not found then raise exception 'Settlement not found or cannot be changed'; end if;
end;
$$;

revoke all on function private.member_currency_balance(uuid, uuid, text) from public, anon, authenticated;

revoke all on function public.record_settlement(uuid, uuid, text, bigint) from public, anon;
revoke all on function public.unrecord_settlement(uuid) from public, anon;
grant execute on function public.record_settlement(uuid, uuid, text, bigint) to authenticated;
grant execute on function public.unrecord_settlement(uuid) to authenticated;
