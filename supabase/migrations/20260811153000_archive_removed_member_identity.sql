create table public.trip_member_archives (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null,
  display_name text not null check (char_length(display_name) between 1 and 80),
  avatar_path text,
  removed_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

alter table public.trip_member_archives enable row level security;
grant select on public.trip_member_archives to authenticated;

create policy trip_member_archives_read_members
on public.trip_member_archives for select to authenticated
using (private.is_trip_member(trip_id));

create or replace function private.manage_trip_member(
  requested_trip_id uuid,
  target_user_id uuid,
  requested_role public.trip_role,
  remove_member boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  target_current_role public.trip_role;
begin
  if actor_user_id is null then raise exception 'Authentication required'; end if;
  if not private.is_trip_owner(requested_trip_id) then raise exception 'Only trip owners can manage travellers'; end if;
  if actor_user_id = target_user_id then raise exception 'Ask another owner to change your own membership'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('trip-membership:' || requested_trip_id::text, 0)
  );

  select role into target_current_role
  from public.trip_members
  where trip_id = requested_trip_id and user_id = target_user_id
  for update;

  if target_current_role is null then raise exception 'Traveller is not a member of this trip'; end if;

  if remove_member then
    if exists (
      select 1
      from (
        select distinct e.currency
        from public.expenses e
        join public.expense_payers ep on ep.expense_id = e.id
        where e.trip_id = requested_trip_id and ep.user_id = target_user_id
        union
        select distinct e.currency
        from public.expenses e
        join public.expense_allocation_groups eag on eag.expense_id = e.id
        join public.expense_shares es on es.allocation_group_id = eag.id
        where e.trip_id = requested_trip_id and es.user_id = target_user_id
        union
        select distinct s.currency
        from public.settlements s
        where s.trip_id = requested_trip_id
          and (s.from_user_id = target_user_id or s.to_user_id = target_user_id)
      ) currencies
      where private.member_currency_balance(requested_trip_id, target_user_id, currencies.currency) <> 0
    ) then
      raise exception 'Settle this traveller''s outstanding balance before removing them';
    end if;

    insert into public.trip_member_archives (trip_id, user_id, display_name, avatar_path, removed_at)
    select requested_trip_id, p.id, p.display_name, p.avatar_path, now()
    from public.profiles p
    where p.id = target_user_id
    on conflict (trip_id, user_id) do update
    set display_name = excluded.display_name,
        avatar_path = excluded.avatar_path,
        removed_at = excluded.removed_at;

    delete from public.segment_members sm
    using public.segments s
    where sm.segment_id = s.id
      and s.trip_id = requested_trip_id
      and sm.user_id = target_user_id;

    delete from public.item_participants ip
    using public.itinerary_items item
    where ip.item_id = item.id
      and item.trip_id = requested_trip_id
      and ip.user_id = target_user_id;

    delete from public.trip_members
    where trip_id = requested_trip_id and user_id = target_user_id;
  else
    if requested_role is null then raise exception 'Role is required'; end if;
    update public.trip_members
    set role = requested_role
    where trip_id = requested_trip_id and user_id = target_user_id;
  end if;
end;
$$;

create or replace function public.create_equal_expense(
  requested_trip_id uuid,
  expense_title text,
  expense_currency text,
  expense_total_minor bigint,
  payer_user_id uuid,
  participant_user_ids uuid[],
  expense_occurred_at timestamptz default now(),
  requested_segment_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  created_expense_id uuid := gen_random_uuid();
  allocation_group_id uuid := gen_random_uuid();
  participant_count integer := cardinality(participant_user_ids);
  base_share bigint;
  remainder bigint;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('trip-membership:' || requested_trip_id::text, 0)
  );

  if not public.is_trip_member(requested_trip_id) then raise exception 'Trip membership required'; end if;
  if char_length(trim(expense_title)) not between 1 and 180 then raise exception 'Expense title is required'; end if;
  if upper(expense_currency) !~ '^[A-Z]{3}$' then raise exception 'Currency must be a three-letter ISO code'; end if;
  if expense_total_minor <= 0 then raise exception 'Expense total must be positive'; end if;
  if participant_count is null or participant_count = 0 then raise exception 'At least one participant is required'; end if;
  if participant_count <> (
    select count(distinct participant.user_id)
    from unnest(participant_user_ids) as participant(user_id)
  ) then raise exception 'Participants must be unique'; end if;
  if not public.is_user_trip_member(requested_trip_id, payer_user_id) then raise exception 'Payer must be a trip member'; end if;
  if exists (
    select 1 from unnest(participant_user_ids) as participant(user_id)
    where not public.is_user_trip_member(requested_trip_id, participant.user_id)
  ) then raise exception 'Every participant must be a trip member'; end if;
  if requested_segment_id is not null and not public.can_read_segment(requested_segment_id) then
    raise exception 'Segment access required';
  end if;

  insert into public.expenses (
    id, trip_id, segment_id, created_by, title, currency, total_minor, occurred_at, source
  ) values (
    created_expense_id, requested_trip_id, requested_segment_id, current_user_id,
    trim(expense_title), upper(expense_currency), expense_total_minor, expense_occurred_at, 'manual'
  );

  insert into public.expense_payers (expense_id, user_id, amount_minor)
  values (created_expense_id, payer_user_id, expense_total_minor);

  insert into public.expense_allocation_groups (id, expense_id, label, amount_minor)
  values (allocation_group_id, created_expense_id, 'Equal split', expense_total_minor);

  base_share := expense_total_minor / participant_count;
  remainder := expense_total_minor % participant_count;

  insert into public.expense_shares (allocation_group_id, user_id, amount_minor)
  select allocation_group_id, participant_id,
    base_share + case when position <= remainder then 1 else 0 end
  from unnest(participant_user_ids) with ordinality as participants(participant_id, position);

  return created_expense_id;
end;
$$;

revoke all on function private.manage_trip_member(uuid, uuid, public.trip_role, boolean) from public, anon;
grant execute on function private.manage_trip_member(uuid, uuid, public.trip_role, boolean) to authenticated;
revoke all on function public.create_equal_expense(uuid, text, text, bigint, uuid, uuid[], timestamptz, uuid) from public, anon;
grant execute on function public.create_equal_expense(uuid, text, text, bigint, uuid, uuid[], timestamptz, uuid) to authenticated;
