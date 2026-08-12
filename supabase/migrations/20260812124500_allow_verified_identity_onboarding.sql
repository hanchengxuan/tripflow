create or replace function private.complete_profile_onboarding()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  has_verified_identity boolean;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;

  select email_confirmed_at is not null or phone_confirmed_at is not null
  into has_verified_identity
  from auth.users where id = current_user_id;

  if not coalesce(has_verified_identity, false) then
    raise exception 'Verify an email, phone number, or social identity before completing registration';
  end if;

  update public.profiles
  set onboarding_completed = true, updated_at = now()
  where id = current_user_id and deleted_at is null;
  if not found then raise exception 'Profile not found'; end if;
end;
$$;
