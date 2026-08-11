create or replace function public.create_trip_invite(
  requested_trip_id uuid,
  invited_role public.trip_role default 'editor',
  valid_for_hours integer default 168,
  allowed_uses integer default 8
)
returns table (invite_token text, invite_expires_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  raw_token text := encode(extensions.gen_random_bytes(24), 'hex');
  expiry timestamptz := now() + make_interval(hours => valid_for_hours);
begin
  if not public.is_trip_owner(requested_trip_id) then raise exception 'Only a trip owner can create invites'; end if;
  if invited_role not in ('editor', 'viewer') then raise exception 'Invite role must be editor or viewer'; end if;
  if valid_for_hours not between 1 and 720 then raise exception 'Invite validity must be between 1 and 720 hours'; end if;
  if allowed_uses not between 1 and 32 then raise exception 'Invite uses must be between 1 and 32'; end if;

  insert into public.trip_invites (
    trip_id, token_digest, role, created_by, expires_at, max_uses
  ) values (
    requested_trip_id,
    encode(extensions.digest(raw_token, 'sha256'), 'hex'),
    invited_role,
    (select auth.uid()),
    expiry,
    allowed_uses
  );

  return query select raw_token, expiry;
end;
$$;

create or replace function private.accept_trip_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  matched_invite public.trip_invites;
  inserted_count integer;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if char_length(trim(invite_token)) <> 48 then raise exception 'Invite code is invalid'; end if;

  select * into matched_invite
  from public.trip_invites
  where token_digest = encode(extensions.digest(trim(invite_token), 'sha256'), 'hex')
    and revoked_at is null
    and expires_at > now()
    and use_count < max_uses
  for update;

  if matched_invite.id is null then raise exception 'Invite code is invalid or expired'; end if;

  insert into public.trip_members (trip_id, user_id, role)
  values (matched_invite.trip_id, current_user_id, matched_invite.role)
  on conflict (trip_id, user_id) do nothing;
  get diagnostics inserted_count = row_count;

  if inserted_count = 1 then
    update public.trip_invites set use_count = use_count + 1 where id = matched_invite.id;
  end if;

  return matched_invite.trip_id;
end;
$$;

revoke all on function public.create_trip_invite(uuid, public.trip_role, integer, integer) from public, anon;
grant execute on function public.create_trip_invite(uuid, public.trip_role, integer, integer) to authenticated;
revoke all on function private.accept_trip_invite(text) from public, anon;
grant execute on function private.accept_trip_invite(text) to authenticated;
