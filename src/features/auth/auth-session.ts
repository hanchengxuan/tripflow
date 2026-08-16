import type { AuthChangeEvent } from '@supabase/supabase-js';

/**
 * A SIGNED_IN event can re-confirm an existing session, so only reset
 * user-scoped onboarding state when the user identity actually changes.
 */
export function shouldResetOnboarding(
  event: AuthChangeEvent,
  previousUserId: string | null,
  nextUserId: string | null,
) {
  if (event === 'SIGNED_OUT') return true;
  return event === 'SIGNED_IN' && previousUserId !== nextUserId;
}

/**
 * Whether a recovery flow is in progress after this event.
 *
 * Supabase emits PASSWORD_RECOVERY once it has exchanged a recovery link for a
 * session, wherever the link happened to land — an admin-sent recovery email
 * carries no `redirectTo` at all and arrives on the Site URL. Tracking the
 * event rather than the path is what makes those links usable.
 *
 * The recovery session is a normal session as far as later events go, so only
 * signing out or finishing the reset ends it.
 */
export function nextRecoveryState(event: AuthChangeEvent, recovering: boolean) {
  if (event === 'PASSWORD_RECOVERY') return true;
  if (event === 'SIGNED_OUT') return false;
  return recovering;
}
