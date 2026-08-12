revoke update on public.profiles from authenticated;
grant update (display_name, avatar_path, updated_at) on public.profiles to authenticated;

create or replace function private.complete_profile_onboarding()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  has_password boolean;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  select coalesce(char_length(encrypted_password), 0) > 0 into has_password
  from auth.users where id = current_user_id;
  if not coalesce(has_password, false) then raise exception 'Set a password before completing registration'; end if;

  update public.profiles
  set onboarding_completed = true, updated_at = now()
  where id = current_user_id and deleted_at is null;
  if not found then raise exception 'Profile not found'; end if;
end;
$$;

create or replace function public.complete_profile_onboarding()
returns void
language sql
security invoker
set search_path = ''
as $$ select private.complete_profile_onboarding(); $$;

revoke all on function private.complete_profile_onboarding() from public, anon;
grant execute on function private.complete_profile_onboarding() to authenticated;
revoke all on function public.complete_profile_onboarding() from public, anon;
grant execute on function public.complete_profile_onboarding() to authenticated;
