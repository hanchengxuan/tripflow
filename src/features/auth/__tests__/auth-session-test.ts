import { shouldResetOnboarding } from '@/features/auth/auth-session';

describe('shouldResetOnboarding', () => {
  it('keeps the product mounted when the same user re-confirms a session', () => {
    expect(shouldResetOnboarding('SIGNED_IN', 'user-a', 'user-a')).toBe(false);
  });

  it('resets onboarding state when a new user signs in', () => {
    expect(shouldResetOnboarding('SIGNED_IN', null, 'user-a')).toBe(true);
    expect(shouldResetOnboarding('SIGNED_IN', 'user-a', 'user-b')).toBe(true);
  });

  it('resets onboarding state after sign out', () => {
    expect(shouldResetOnboarding('SIGNED_OUT', 'user-a', null)).toBe(true);
  });

  it('ignores non-identity auth events', () => {
    expect(shouldResetOnboarding('TOKEN_REFRESHED', 'user-a', 'user-a')).toBe(false);
    expect(shouldResetOnboarding('USER_UPDATED', 'user-a', 'user-a')).toBe(false);
    expect(shouldResetOnboarding('INITIAL_SESSION', null, 'user-a')).toBe(false);
  });
});
