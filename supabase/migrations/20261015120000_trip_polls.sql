create table public.trip_polls (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  question text not null check (char_length(question) between 1 and 160),
  closes_at timestamptz,
  selected_option_id uuid,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((closed_at is null) = (selected_option_id is null))
);
create index trip_polls_trip_id_idx on public.trip_polls(trip_id, created_at desc);

create table public.trip_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.trip_polls(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  position smallint not null check (position between 0 and 5),
  unique (poll_id, position)
);
alter table public.trip_polls
  add constraint trip_polls_selected_option_fkey foreign key (selected_option_id) references public.trip_poll_options(id);

create table public.trip_poll_votes (
  poll_id uuid not null references public.trip_polls(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  option_id uuid not null references public.trip_poll_options(id) on delete cascade,
  voted_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);
create index trip_poll_votes_option_id_idx on public.trip_poll_votes(option_id);

alter table public.trip_polls enable row level security;
alter table public.trip_poll_options enable row level security;
alter table public.trip_poll_votes enable row level security;
revoke all on public.trip_polls, public.trip_poll_options, public.trip_poll_votes from anon, authenticated;
grant select on public.trip_polls, public.trip_poll_options, public.trip_poll_votes to authenticated;

create policy trip_polls_read on public.trip_polls for select to authenticated
  using (public.is_trip_member(trip_id));
create policy trip_poll_options_read on public.trip_poll_options for select to authenticated
  using (exists (select 1 from public.trip_polls p where p.id = poll_id and public.is_trip_member(p.trip_id)));
create policy trip_poll_votes_read on public.trip_poll_votes for select to authenticated
  using (exists (select 1 from public.trip_polls p where p.id = poll_id and public.is_trip_member(p.trip_id)));

create function private.create_trip_poll(requested_trip_id uuid, poll_question text, option_labels text[], poll_closes_at timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  clean_question text := trim(poll_question);
  clean_labels text[];
  poll_id uuid;
begin
  if actor is null or not exists (select 1 from public.profiles where id = actor and deleted_at is null) then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.trip_members where trip_id = requested_trip_id and user_id = actor and role in ('owner', 'editor')) then
    raise exception 'Only trip editors can start a poll';
  end if;
  if clean_question is null or char_length(clean_question) not between 1 and 160 then raise exception 'Enter a question of 1 to 160 characters'; end if;
  select array_agg(trim(label) order by ordinality) into clean_labels from unnest(option_labels) with ordinality as label;
  if clean_labels is null or cardinality(clean_labels) not between 2 and 6 then raise exception 'Add 2 to 6 options'; end if;
  if exists (select 1 from unnest(clean_labels) as label where label is null or char_length(label) not between 1 and 120) then
    raise exception 'Each option needs 1 to 120 characters';
  end if;
  if (select count(distinct lower(label)) from unnest(clean_labels) as label) <> cardinality(clean_labels) then raise exception 'Options must be different'; end if;
  if poll_closes_at is not null and poll_closes_at <= now() then raise exception 'The deadline must be in the future'; end if;

  insert into public.trip_polls (trip_id, created_by, question, closes_at)
  values (requested_trip_id, actor, clean_question, poll_closes_at) returning id into poll_id;
  insert into public.trip_poll_options (poll_id, label, position)
  select poll_id, label, (ordinality - 1)::smallint from unnest(clean_labels) with ordinality as label;
  return poll_id;
end;
$$;

create function private.vote_trip_poll(requested_poll_id uuid, requested_option_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  poll public.trip_polls;
begin
  if actor is null or not exists (select 1 from public.profiles where id = actor and deleted_at is null) then raise exception 'Authentication required'; end if;
  select * into poll from public.trip_polls where id = requested_poll_id for update;
  if poll.id is null or not exists (select 1 from public.trip_members where trip_id = poll.trip_id and user_id = actor) then raise exception 'Poll not found'; end if;
  if poll.closed_at is not null or (poll.closes_at is not null and poll.closes_at <= now()) then raise exception 'This poll is closed'; end if;
  if not exists (select 1 from public.trip_poll_options where id = requested_option_id and poll_id = poll.id) then raise exception 'Choose an option from this poll'; end if;

  insert into public.trip_poll_votes (poll_id, user_id, option_id) values (poll.id, actor, requested_option_id)
  on conflict (poll_id, user_id) do update set option_id = excluded.option_id, voted_at = now();
end;
$$;

create function private.close_trip_poll(requested_poll_id uuid, requested_option_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  poll public.trip_polls;
begin
  if actor is null or not exists (select 1 from public.profiles where id = actor and deleted_at is null) then raise exception 'Authentication required'; end if;
  select * into poll from public.trip_polls where id = requested_poll_id for update;
  if poll.id is null or not exists (select 1 from public.trip_members where trip_id = poll.trip_id and user_id = actor) then raise exception 'Poll not found'; end if;
  if poll.created_by <> actor and not exists (select 1 from public.trip_members where trip_id = poll.trip_id and user_id = actor and role in ('owner', 'editor')) then
    raise exception 'Only the poll creator or a trip editor can close it';
  end if;
  if poll.closed_at is not null then raise exception 'This poll is already decided'; end if;
  if not exists (select 1 from public.trip_poll_options where id = requested_option_id and poll_id = poll.id) then raise exception 'Choose an option from this poll'; end if;

  update public.trip_polls set selected_option_id = requested_option_id, closed_at = now() where id = poll.id;
end;
$$;

create function private.delete_trip_poll(requested_poll_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  poll public.trip_polls;
begin
  if actor is null or not exists (select 1 from public.profiles where id = actor and deleted_at is null) then raise exception 'Authentication required'; end if;
  select * into poll from public.trip_polls where id = requested_poll_id for update;
  if poll.id is null or not exists (select 1 from public.trip_members where trip_id = poll.trip_id and user_id = actor) then raise exception 'Poll not found'; end if;
  if poll.created_by <> actor and not exists (select 1 from public.trip_members where trip_id = poll.trip_id and user_id = actor and role in ('owner', 'editor')) then
    raise exception 'Only the poll creator or a trip editor can delete it';
  end if;
  delete from public.trip_polls where id = poll.id;
end;
$$;

create function public.create_trip_poll(requested_trip_id uuid, poll_question text, option_labels text[], poll_closes_at timestamptz default null)
returns uuid language sql security invoker set search_path = '' as $$
  select private.create_trip_poll(requested_trip_id, poll_question, option_labels, poll_closes_at);
$$;
create function public.vote_trip_poll(requested_poll_id uuid, requested_option_id uuid)
returns void language sql security invoker set search_path = '' as $$
  select private.vote_trip_poll(requested_poll_id, requested_option_id);
$$;
create function public.close_trip_poll(requested_poll_id uuid, requested_option_id uuid)
returns void language sql security invoker set search_path = '' as $$
  select private.close_trip_poll(requested_poll_id, requested_option_id);
$$;
create function public.delete_trip_poll(requested_poll_id uuid)
returns void language sql security invoker set search_path = '' as $$
  select private.delete_trip_poll(requested_poll_id);
$$;

revoke all on function private.create_trip_poll(uuid, text, text[], timestamptz) from public, anon;
revoke all on function private.vote_trip_poll(uuid, uuid) from public, anon;
revoke all on function private.close_trip_poll(uuid, uuid) from public, anon;
revoke all on function private.delete_trip_poll(uuid) from public, anon;
revoke all on function public.create_trip_poll(uuid, text, text[], timestamptz) from public, anon;
revoke all on function public.vote_trip_poll(uuid, uuid) from public, anon;
revoke all on function public.close_trip_poll(uuid, uuid) from public, anon;
revoke all on function public.delete_trip_poll(uuid) from public, anon;
grant execute on function private.create_trip_poll(uuid, text, text[], timestamptz) to authenticated;
grant execute on function private.vote_trip_poll(uuid, uuid) to authenticated;
grant execute on function private.close_trip_poll(uuid, uuid) to authenticated;
grant execute on function private.delete_trip_poll(uuid) to authenticated;
grant execute on function public.create_trip_poll(uuid, text, text[], timestamptz) to authenticated;
grant execute on function public.vote_trip_poll(uuid, uuid) to authenticated;
grant execute on function public.close_trip_poll(uuid, uuid) to authenticated;
grant execute on function public.delete_trip_poll(uuid) to authenticated;
