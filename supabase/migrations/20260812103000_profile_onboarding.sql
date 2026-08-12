alter table public.profiles
  add column onboarding_completed boolean not null default false;

-- Existing accounts predate onboarding and must keep their current access.
update public.profiles set onboarding_completed = true;
