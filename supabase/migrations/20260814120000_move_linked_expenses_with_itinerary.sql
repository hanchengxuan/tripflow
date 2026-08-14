-- Move ledger rows linked to an itinerary item with the item itself.
-- The expense evidence, allocations, receipts, and itinerary link stay intact;
-- only trip ownership and source-trip segment scope change.
alter table public.expenses
  alter constraint expenses_itinerary_item_same_trip_fk deferrable initially deferred;

create or replace function private.move_itinerary_item(
  requested_item_id uuid,
  requested_target_trip_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  source_item public.itinerary_items;
  linked_stay public.itinerary_items;
  linked_transfer public.itinerary_items;
  moved_item_ids uuid[];
begin
  if actor_user_id is null then raise exception 'Authentication required'; end if;
  if requested_item_id is null or requested_target_trip_id is null then
    raise exception 'Item and target trip are required';
  end if;

  select * into source_item
  from public.itinerary_items
  where id = requested_item_id
  for update;

  if source_item.id is null then raise exception 'Itinerary item not found'; end if;
  if source_item.trip_id = requested_target_trip_id then raise exception 'Item is already in this trip'; end if;
  if not private.can_edit_trip(source_item.trip_id) then
    raise exception 'Only owners and editors can move this plan';
  end if;
  if not private.can_edit_trip(requested_target_trip_id) then
    raise exception 'Only owners and editors can move to the target trip';
  end if;

  -- Lock both trip rows so a concurrent trip deletion or move cannot split the operation.
  perform 1
  from public.trips
  where id in (source_item.trip_id, requested_target_trip_id)
  order by id
  for update;

  if source_item.linked_stay_id is not null then
    select * into linked_stay
    from public.itinerary_items
    where id = source_item.linked_stay_id
    for update;
    if linked_stay.id is null or linked_stay.trip_id <> source_item.trip_id or linked_stay.kind <> 'lodging' then
      raise exception 'Linked stay not found';
    end if;
    moved_item_ids := array[source_item.id, linked_stay.id];
  elsif source_item.kind = 'lodging' then
    select * into linked_transfer
    from public.itinerary_items
    where linked_stay_id = source_item.id
    for update;
    moved_item_ids := case
      when linked_transfer.id is null then array[source_item.id]
      else array[source_item.id, linked_transfer.id]
    end;
  else
    moved_item_ids := array[source_item.id];
  end if;

  -- Lock linked ledger rows before changing their composite same-trip foreign key.
  perform 1
  from public.expenses
  where itinerary_item_id = any(moved_item_ids)
  order by id
  for update;

  -- Segment scope belongs to the source trip. Preserve the expense-to-plan link
  -- and all financial evidence while moving the ledger row to the destination.
  update public.expenses
  set trip_id = requested_target_trip_id,
      segment_id = null,
      updated_at = now(),
      version = version + 1
  where itinerary_item_id = any(moved_item_ids);

  delete from public.item_participants participant
  where participant.item_id = any(moved_item_ids)
    and not exists (
      select 1
      from public.trip_members member
      where member.trip_id = requested_target_trip_id
        and member.user_id = participant.user_id
    );

  update public.itinerary_items
  set trip_id = requested_target_trip_id,
      segment_id = null,
      responsible_user_id = case
        when responsible_user_id is not null and exists (
          select 1
          from public.trip_members member
          where member.trip_id = requested_target_trip_id
            and member.user_id = public.itinerary_items.responsible_user_id
        ) then responsible_user_id
        else null
      end,
      updated_at = now(),
      version = version + 1
  where id = any(moved_item_ids);

  -- Recompute automatic expense state for both ledgers after the ownership move.
  perform private.refresh_expense_settlement_flags(source_item.trip_id, actor_user_id);
  perform private.refresh_expense_settlement_flags(requested_target_trip_id, actor_user_id);

  return source_item.id;
end;
$$;

revoke all on function private.move_itinerary_item(uuid, uuid) from public, anon;
grant execute on function private.move_itinerary_item(uuid, uuid) to authenticated;
