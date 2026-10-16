create function private.withdraw_trip_poll_vote(requested_poll_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  poll public.trip_polls;
begin
  if actor is null or not exists (select 1 from public.profiles where id = actor and deleted_at is null) then raise exception 'Authentication required'; end if;
  select * into poll from public.trip_polls where id = requested_poll_id for update;
  if poll.id is null or not exists (select 1 from public.trip_members where trip_id = poll.trip_id and user_id = actor) then raise exception 'Poll not found'; end if;
  if poll.closed_at is not null or (poll.closes_at is not null and poll.closes_at <= now()) then raise exception 'This poll is closed'; end if;

  delete from public.trip_poll_votes where poll_id = poll.id and user_id = actor;
end;
$$;

create function public.withdraw_trip_poll_vote(requested_poll_id uuid)
returns void language sql security invoker set search_path = '' as $$
  select private.withdraw_trip_poll_vote(requested_poll_id);
$$;

revoke all on function private.withdraw_trip_poll_vote(uuid) from public, anon;
revoke all on function public.withdraw_trip_poll_vote(uuid) from public, anon;
grant execute on function private.withdraw_trip_poll_vote(uuid) to authenticated;
grant execute on function public.withdraw_trip_poll_vote(uuid) to authenticated;
