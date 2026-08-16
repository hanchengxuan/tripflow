import { nextRecoveryState, shouldResetOnboarding } from '@/features/auth/auth-session';

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

describe('nextRecoveryState', () => {
  it('starts recovering when Supabase exchanges a recovery link', () => {
    expect(nextRecoveryState('PASSWORD_RECOVERY', false)).toBe(true);
  });

  it('keeps recovering through the refreshes that follow', () => {
    // The recovery session behaves like any other session afterwards, so these
    // must not silently drop the traveller back into the product.
    expect(nextRecoveryState('TOKEN_REFRESHED', true)).toBe(true);
    expect(nextRecoveryState('SIGNED_IN', true)).toBe(true);
    expect(nextRecoveryState('USER_UPDATED', true)).toBe(true);
  });

  it('ends recovering on sign out', () => {
    expect(nextRecoveryState('SIGNED_OUT', true)).toBe(false);
  });

  it('leaves a normal session alone', () => {
    expect(nextRecoveryState('SIGNED_IN', false)).toBe(false);
    expect(nextRecoveryState('TOKEN_REFRESHED', false)).toBe(false);
  });
});
