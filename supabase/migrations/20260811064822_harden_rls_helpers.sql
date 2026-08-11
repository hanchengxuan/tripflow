-- Remote migration version: 20260811064822
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_trip_member(requested_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = requested_trip_id and user_id = (select auth.uid())
  );
$$;

create or replace function private.can_edit_trip(requested_trip_id uuid)
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
      and role in ('owner', 'editor')
  );
$$;

create or replace function private.is_trip_owner(requested_trip_id uuid)
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

create or replace function private.is_trip_creator(requested_trip_id uuid)
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

create or replace function private.is_user_trip_member(requested_trip_id uuid, requested_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_trip_member(requested_trip_id)
    and exists (
      select 1 from public.trip_members
      where trip_id = requested_trip_id and user_id = requested_user_id
    );
$$;

create or replace function private.can_read_segment(requested_segment_id uuid)
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
          where sm.segment_id = s.id and sm.user_id = (select auth.uid())
        )
        or (s.visibility = 'trip_read_only' and private.is_trip_member(s.trip_id))
      )
  );
$$;

revoke all on function private.is_trip_member(uuid) from public, anon;
revoke all on function private.can_edit_trip(uuid) from public, anon;
revoke all on function private.is_trip_owner(uuid) from public, anon;
revoke all on function private.is_trip_creator(uuid) from public, anon;
revoke all on function private.is_user_trip_member(uuid, uuid) from public, anon;
revoke all on function private.can_read_segment(uuid) from public, anon;
grant execute on function private.is_trip_member(uuid) to authenticated;
grant execute on function private.can_edit_trip(uuid) to authenticated;
grant execute on function private.is_trip_owner(uuid) to authenticated;
grant execute on function private.is_trip_creator(uuid) to authenticated;
grant execute on function private.is_user_trip_member(uuid, uuid) to authenticated;
grant execute on function private.can_read_segment(uuid) to authenticated;

create or replace function public.is_trip_member(requested_trip_id uuid)
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.is_trip_member(requested_trip_id); $$;
create or replace function public.can_edit_trip(requested_trip_id uuid)
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.can_edit_trip(requested_trip_id); $$;
create or replace function public.is_trip_owner(requested_trip_id uuid)
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.is_trip_owner(requested_trip_id); $$;
create or replace function public.is_trip_creator(requested_trip_id uuid)
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.is_trip_creator(requested_trip_id); $$;
create or replace function public.is_user_trip_member(requested_trip_id uuid, requested_user_id uuid)
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.is_user_trip_member(requested_trip_id, requested_user_id); $$;
create or replace function public.can_read_segment(requested_segment_id uuid)
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.can_read_segment(requested_segment_id); $$;

revoke all on function public.is_trip_member(uuid) from public, anon;
revoke all on function public.can_edit_trip(uuid) from public, anon;
revoke all on function public.is_trip_owner(uuid) from public, anon;
revoke all on function public.is_trip_creator(uuid) from public, anon;
revoke all on function public.is_user_trip_member(uuid, uuid) from public, anon;
revoke all on function public.can_read_segment(uuid) from public, anon;
grant execute on function public.is_trip_member(uuid) to authenticated;
grant execute on function public.can_edit_trip(uuid) to authenticated;
grant execute on function public.is_trip_owner(uuid) to authenticated;
grant execute on function public.is_trip_creator(uuid) to authenticated;
grant execute on function public.is_user_trip_member(uuid, uuid) to authenticated;
grant execute on function public.can_read_segment(uuid) to authenticated;
