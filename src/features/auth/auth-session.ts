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
