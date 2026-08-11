-- Account deletion must also remove the public reference to a former avatar.
-- The client deletes the storage object before invoking this RPC; clearing the
-- path here provides a database-level privacy backstop.
create or replace function private.delete_current_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  owned_trip record;
  successor_id uuid;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if not private.is_active_user(current_user_id) then raise exception 'Account is already deleted'; end if;

  for owned_trip in
    select id from public.trips where created_by = current_user_id for update
  loop
    select tm.user_id into successor_id
    from public.trip_members tm
    where tm.trip_id = owned_trip.id and tm.user_id <> current_user_id
    order by
      case tm.role when 'owner' then 0 when 'editor' then 1 else 2 end,
      tm.joined_at,
      tm.user_id
    limit 1;

    if successor_id is null then
      delete from public.trips where id = owned_trip.id;
    else
      update public.trip_members
      set role = 'owner'
      where trip_id = owned_trip.id and user_id = successor_id;

      update public.trips
      set created_by = successor_id, updated_at = now()
      where id = owned_trip.id;
    end if;
  end loop;

  delete from public.segment_members where user_id = current_user_id;
  delete from public.trip_members where user_id = current_user_id;

  update public.profiles
  set display_name = '已注销用户', avatar_path = null, deleted_at = now(), updated_at = now()
  where id = current_user_id;

  delete from auth.users where id = current_user_id;
end;
$$;

revoke all on function private.delete_current_account() from public, anon, authenticated;
grant execute on function private.delete_current_account() to authenticated;
