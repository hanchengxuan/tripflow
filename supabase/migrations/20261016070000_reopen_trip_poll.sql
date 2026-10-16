-- Reopening keeps closes_at: a poll past its deadline comes back as expired, so a manager can pick again without reviving voting.
create function private.reopen_trip_poll(requested_poll_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  poll public.trip_polls;
begin
  if actor is null or not exists (select 1 from public.profiles where id = actor and deleted_at is null) then raise exception 'Authentication required'; end if;
  select * into poll from public.trip_polls where id = requested_poll_id for update;
  if poll.id is null or not exists (select 1 from public.trip_members where trip_id = poll.trip_id and user_id = actor) then raise exception 'Poll not found'; end if;
  if poll.created_by <> actor and not exists (select 1 from public.trip_members where trip_id = poll.trip_id and user_id = actor and role in ('owner', 'editor')) then
    raise exception 'Only the poll creator or a trip editor can reopen it';
  end if;
  if poll.closed_at is null then raise exception 'This poll is not decided yet'; end if;

  update public.trip_polls set selected_option_id = null, closed_at = null where id = poll.id;
end;
$$;

create function public.reopen_trip_poll(requested_poll_id uuid)
returns void language sql security invoker set search_path = '' as $$
  select private.reopen_trip_poll(requested_poll_id);
$$;

revoke all on function private.reopen_trip_poll(uuid) from public, anon;
revoke all on function public.reopen_trip_poll(uuid) from public, anon;
grant execute on function private.reopen_trip_poll(uuid) to authenticated;
grant execute on function public.reopen_trip_poll(uuid) to authenticated;
