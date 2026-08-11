-- Remote migration version: 20260811064629
create extension if not exists pgcrypto;

create type public.trip_role as enum ('owner', 'editor', 'viewer');
create type public.segment_visibility as enum ('members_only', 'trip_read_only');
create type public.itinerary_kind as enum ('transport', 'lodging', 'food', 'activity', 'note', 'task');
create type public.participant_status as enum ('going', 'arrived', 'delayed', 'not_participating');
create type public.expense_source as enum ('manual', 'text', 'voice', 'receipt');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id),
  name text not null check (char_length(name) between 1 and 120),
  starts_on date not null,
  ends_on date not null,
  home_currency text not null check (home_currency ~ '^[A-Z]{3}$'),
  default_time_zone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create table public.trip_members (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.trip_role not null default 'viewer',
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table public.segments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  parent_segment_id uuid references public.segments(id) on delete set null,
  created_by uuid not null references public.profiles(id),
  name text not null check (char_length(name) between 1 and 120),
  location_label text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  visibility public.segment_visibility not null default 'members_only',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at >= starts_at)
);

create table public.segment_members (
  segment_id uuid not null references public.segments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (segment_id, user_id)
);

create table public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  segment_id uuid references public.segments(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  kind public.itinerary_kind not null,
  title text not null check (char_length(title) between 1 and 180),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location_label text,
  local_script_address text,
  responsible_user_id uuid references public.profiles(id) on delete set null,
  confirmation_number text,
  notes text,
  is_material_change boolean not null default false,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);

create table public.item_participants (
  item_id uuid not null references public.itinerary_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.participant_status not null default 'going',
  acknowledged_version integer not null default 0 check (acknowledged_version >= 0),
  updated_at timestamptz not null default now(),
  primary key (item_id, user_id)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  segment_id uuid references public.segments(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title text not null check (char_length(title) between 1 and 180),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  total_minor bigint not null check (total_minor >= 0),
  occurred_at timestamptz not null,
  source public.expense_source not null default 'manual',
  source_transcript text,
  parser_confidence numeric(5, 4) check (parser_confidence between 0 and 1),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.expense_payers (
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  amount_minor bigint not null check (amount_minor >= 0),
  primary key (expense_id, user_id)
);

create table public.expense_allocation_groups (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  label text not null default 'General',
  amount_minor bigint not null check (amount_minor >= 0)
);

create table public.expense_shares (
  allocation_group_id uuid not null references public.expense_allocation_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  amount_minor bigint not null check (amount_minor >= 0),
  primary key (allocation_group_id, user_id)
);

create table public.exchange_rate_snapshots (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  base_currency text not null check (base_currency ~ '^[A-Z]{3}$'),
  quote_currency text not null check (quote_currency ~ '^[A-Z]{3}$'),
  rate numeric(24, 12) not null check (rate > 0),
  source text not null,
  captured_at timestamptz not null,
  created_by uuid references public.profiles(id),
  check (base_currency <> quote_currency)
);

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  segment_id uuid references public.segments(id) on delete set null,
  from_user_id uuid not null references public.profiles(id),
  to_user_id uuid not null references public.profiles(id),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor > 0),
  settled_at timestamptz not null,
  recorded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (from_user_id <> to_user_id)
);

create table public.activity_events (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  segment_id uuid references public.segments(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.segments
  add constraint segments_id_trip_unique unique (id, trip_id),
  add constraint segments_parent_same_trip_fk
    foreign key (parent_segment_id, trip_id) references public.segments (id, trip_id);
alter table public.itinerary_items
  add constraint itinerary_segment_same_trip_fk
    foreign key (segment_id, trip_id) references public.segments (id, trip_id);
alter table public.expenses
  add constraint expenses_segment_same_trip_fk
    foreign key (segment_id, trip_id) references public.segments (id, trip_id);
alter table public.settlements
  add constraint settlements_segment_same_trip_fk
    foreign key (segment_id, trip_id) references public.segments (id, trip_id);
alter table public.activity_events
  add constraint activity_segment_same_trip_fk
    foreign key (segment_id, trip_id) references public.segments (id, trip_id);

create index segments_trip_dates_idx on public.segments (trip_id, starts_at, ends_at);
create index trip_members_user_trip_idx on public.trip_members (user_id, trip_id);
create index segment_members_user_segment_idx on public.segment_members (user_id, segment_id);
create index itinerary_trip_start_idx on public.itinerary_items (trip_id, starts_at);
create index itinerary_segment_start_idx on public.itinerary_items (segment_id, starts_at);
create index expenses_trip_occurred_idx on public.expenses (trip_id, occurred_at desc);
create index activity_trip_created_idx on public.activity_events (trip_id, created_at desc);

create or replace function public.is_trip_member(requested_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = requested_trip_id and user_id = auth.uid()
  );
$$;

create or replace function public.can_edit_trip(requested_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = requested_trip_id
      and user_id = auth.uid()
      and role in ('owner', 'editor')
  );
$$;

create or replace function public.is_trip_owner(requested_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = requested_trip_id
      and user_id = (select auth.uid())
      and role = 'owner'
  );
$$;

create or replace function public.is_trip_creator(requested_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trips
    where id = requested_trip_id and created_by = (select auth.uid())
  );
$$;

create or replace function public.is_user_trip_member(requested_trip_id uuid, requested_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_trip_member(requested_trip_id)
    and exists (
      select 1 from public.trip_members
      where trip_id = requested_trip_id and user_id = requested_user_id
    );
$$;

create or replace function public.can_read_segment(requested_segment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.segments s
    where s.id = requested_segment_id
      and (
        exists (
          select 1 from public.segment_members sm
          where sm.segment_id = s.id and sm.user_id = auth.uid()
        )
        or (s.visibility = 'trip_read_only' and public.is_trip_member(s.trip_id))
      )
  );
$$;

revoke all on function public.is_trip_member(uuid) from public;
revoke all on function public.can_edit_trip(uuid) from public;
revoke all on function public.is_trip_owner(uuid) from public;
revoke all on function public.is_trip_creator(uuid) from public;
revoke all on function public.is_user_trip_member(uuid, uuid) from public;
revoke all on function public.can_read_segment(uuid) from public;
grant execute on function public.is_trip_member(uuid) to authenticated;
grant execute on function public.can_edit_trip(uuid) to authenticated;
grant execute on function public.is_trip_owner(uuid) to authenticated;
grant execute on function public.is_trip_creator(uuid) to authenticated;
grant execute on function public.is_user_trip_member(uuid, uuid) to authenticated;
grant execute on function public.can_read_segment(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.segments enable row level security;
alter table public.segment_members enable row level security;
alter table public.itinerary_items enable row level security;
alter table public.item_participants enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_payers enable row level security;
alter table public.expense_allocation_groups enable row level security;
alter table public.expense_shares enable row level security;
alter table public.exchange_rate_snapshots enable row level security;
alter table public.settlements enable row level security;
alter table public.activity_events enable row level security;

revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.trips to authenticated;
grant select, insert, update, delete on public.trip_members to authenticated;
grant select, insert, update, delete on public.segments to authenticated;
grant select, insert, delete on public.segment_members to authenticated;
grant select, insert, update, delete on public.itinerary_items to authenticated;
grant select, insert, update on public.item_participants to authenticated;
grant select, insert, update on public.expenses to authenticated;
grant select, insert, update, delete on public.expense_payers to authenticated;
grant select, insert, update, delete on public.expense_allocation_groups to authenticated;
grant select, insert, update, delete on public.expense_shares to authenticated;
grant select, insert, update, delete on public.exchange_rate_snapshots to authenticated;
grant select, insert on public.settlements to authenticated;
grant select, insert on public.activity_events to authenticated;
grant usage, select on sequence public.activity_events_id_seq to authenticated;

create policy profiles_read_self_or_trip_peers on public.profiles for select to authenticated
using (
  id = auth.uid()
  or exists (
    select 1 from public.trip_members mine
    join public.trip_members peer on peer.trip_id = mine.trip_id
    where mine.user_id = auth.uid() and peer.user_id = profiles.id
  )
);
create policy profiles_insert_self on public.profiles for insert to authenticated
with check (id = auth.uid());
create policy profiles_update_self on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

create policy trips_read_members on public.trips for select to authenticated
using (public.is_trip_member(id));
create policy trips_create_self on public.trips for insert to authenticated
with check (created_by = auth.uid());
create policy trips_update_editors on public.trips for update to authenticated
using (public.can_edit_trip(id)) with check (public.can_edit_trip(id));
create policy trips_delete_owner on public.trips for delete to authenticated
using (public.is_trip_owner(id));

create policy trip_members_read_members on public.trip_members for select to authenticated
using (public.is_trip_member(trip_id));
create policy trip_members_add_by_editors_or_creator on public.trip_members for insert to authenticated
with check (
  public.is_trip_owner(trip_id)
  or (
    user_id = auth.uid() and role = 'owner'
    and public.is_trip_creator(trip_id)
  )
);
create policy trip_members_update_owners on public.trip_members for update to authenticated
using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));
create policy trip_members_delete_owners on public.trip_members for delete to authenticated
using (public.is_trip_owner(trip_id));

create policy segments_read_authorized on public.segments for select to authenticated
using (public.can_read_segment(id));
create policy segments_write_editors on public.segments for insert to authenticated
with check (public.can_edit_trip(trip_id) and created_by = auth.uid());
create policy segments_update_editors on public.segments for update to authenticated
using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));
create policy segments_delete_editors on public.segments for delete to authenticated
using (public.can_edit_trip(trip_id));

create policy segment_members_read_authorized on public.segment_members for select to authenticated
using (public.can_read_segment(segment_id));
create policy segment_members_write_editors on public.segment_members for insert to authenticated
with check (exists (
  select 1 from public.segments s
  where s.id = segment_id
    and public.can_edit_trip(s.trip_id)
    and public.is_user_trip_member(s.trip_id, user_id)
));
create policy segment_members_delete_editors on public.segment_members for delete to authenticated
using (exists (
  select 1 from public.segments s where s.id = segment_id and public.can_edit_trip(s.trip_id)
));

create policy itinerary_read_authorized on public.itinerary_items for select to authenticated
using (
  (segment_id is null and public.is_trip_member(trip_id))
  or (segment_id is not null and public.can_read_segment(segment_id))
);
create policy itinerary_insert_editors on public.itinerary_items for insert to authenticated
with check (public.can_edit_trip(trip_id) and created_by = auth.uid());
create policy itinerary_update_editors on public.itinerary_items for update to authenticated
using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));
create policy itinerary_delete_editors on public.itinerary_items for delete to authenticated
using (public.can_edit_trip(trip_id));

create policy item_participants_read_authorized on public.item_participants for select to authenticated
using (exists (
  select 1 from public.itinerary_items i
  where i.id = item_id and (
    (i.segment_id is null and public.is_trip_member(i.trip_id))
    or (i.segment_id is not null and public.can_read_segment(i.segment_id))
  )
));
create policy item_participants_update_self_or_editors on public.item_participants for update to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.itinerary_items i where i.id = item_id and public.can_edit_trip(i.trip_id)
  )
) with check (
  user_id = auth.uid()
  or exists (
    select 1 from public.itinerary_items i where i.id = item_id and public.can_edit_trip(i.trip_id)
  )
);
create policy item_participants_insert_editors on public.item_participants for insert to authenticated
with check (exists (
  select 1 from public.itinerary_items i
  where i.id = item_id
    and public.can_edit_trip(i.trip_id)
    and public.is_user_trip_member(i.trip_id, user_id)
));

create policy expenses_read_authorized on public.expenses for select to authenticated
using (
  (segment_id is null and public.is_trip_member(trip_id))
  or (segment_id is not null and public.can_read_segment(segment_id))
);
create policy expenses_insert_members on public.expenses for insert to authenticated
with check (
  created_by = auth.uid()
  and public.is_trip_member(trip_id)
  and (segment_id is null or public.can_read_segment(segment_id))
);
create policy expenses_update_creator_or_editors on public.expenses for update to authenticated
using (created_by = auth.uid() or public.can_edit_trip(trip_id))
with check (created_by = auth.uid() or public.can_edit_trip(trip_id));

create policy expense_payers_read_authorized on public.expense_payers for select to authenticated
using (exists (select 1 from public.expenses e where e.id = expense_id and (
  (e.segment_id is null and public.is_trip_member(e.trip_id))
  or (e.segment_id is not null and public.can_read_segment(e.segment_id))
)));
create policy expense_payers_write_authorized on public.expense_payers for all to authenticated
using (exists (select 1 from public.expenses e where e.id = expense_id and (e.created_by = auth.uid() or public.can_edit_trip(e.trip_id))))
with check (exists (
  select 1 from public.expenses e
  where e.id = expense_id
    and (e.created_by = auth.uid() or public.can_edit_trip(e.trip_id))
    and public.is_user_trip_member(e.trip_id, user_id)
));

create policy allocation_groups_read_authorized on public.expense_allocation_groups for select to authenticated
using (exists (select 1 from public.expenses e where e.id = expense_id and (
  (e.segment_id is null and public.is_trip_member(e.trip_id))
  or (e.segment_id is not null and public.can_read_segment(e.segment_id))
)));
create policy allocation_groups_write_authorized on public.expense_allocation_groups for all to authenticated
using (exists (select 1 from public.expenses e where e.id = expense_id and (e.created_by = auth.uid() or public.can_edit_trip(e.trip_id))))
with check (exists (select 1 from public.expenses e where e.id = expense_id and (e.created_by = auth.uid() or public.can_edit_trip(e.trip_id))));

create policy expense_shares_read_authorized on public.expense_shares for select to authenticated
using (exists (
  select 1 from public.expense_allocation_groups g
  join public.expenses e on e.id = g.expense_id
  where g.id = allocation_group_id and (
    (e.segment_id is null and public.is_trip_member(e.trip_id))
    or (e.segment_id is not null and public.can_read_segment(e.segment_id))
  )
));
create policy expense_shares_write_authorized on public.expense_shares for all to authenticated
using (exists (
  select 1 from public.expense_allocation_groups g
  join public.expenses e on e.id = g.expense_id
  where g.id = allocation_group_id and (e.created_by = auth.uid() or public.can_edit_trip(e.trip_id))
)) with check (exists (
  select 1 from public.expense_allocation_groups g
  join public.expenses e on e.id = g.expense_id
  where g.id = allocation_group_id
    and (e.created_by = auth.uid() or public.can_edit_trip(e.trip_id))
    and public.is_user_trip_member(e.trip_id, user_id)
));

create policy exchange_rates_read_members on public.exchange_rate_snapshots for select to authenticated
using (public.is_trip_member(trip_id));
create policy exchange_rates_write_editors on public.exchange_rate_snapshots for all to authenticated
using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));

create policy settlements_read_members on public.settlements for select to authenticated
using (public.is_trip_member(trip_id));
create policy settlements_insert_participants on public.settlements for insert to authenticated
with check (
  public.is_trip_member(trip_id)
  and recorded_by = auth.uid()
  and auth.uid() in (from_user_id, to_user_id)
  and public.is_user_trip_member(trip_id, from_user_id)
  and public.is_user_trip_member(trip_id, to_user_id)
);

create policy activity_read_authorized on public.activity_events for select to authenticated
using (
  (segment_id is null and public.is_trip_member(trip_id))
  or (segment_id is not null and public.can_read_segment(segment_id))
);
create policy activity_insert_actor on public.activity_events for insert to authenticated
with check (actor_id = auth.uid() and public.is_trip_member(trip_id));
