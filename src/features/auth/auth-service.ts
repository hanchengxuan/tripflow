import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { getSupabaseClient } from '@/lib/supabase';

import { updateProfile } from '@/data/trip-repository';

export function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();

  if (!normalized || !normalized.includes('@')) {
    throw new Error('请输入有效的邮箱地址。');
  }

  return normalized;
}

export function validatePassword(password: string) {
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error('密码至少 8 位，并同时包含字母和数字。');
  }
  return password;
}

/**
 * Guards a password change before any network call: an empty current password,
 * a new password identical to the current one, or one that fails policy.
 * Ordering matters — policy is checked before re-authentication so a rejected
 * new password never reveals whether the current one was right.
 */
export function assertPasswordChange(currentPassword: string, nextPassword: string) {
  if (!currentPassword) throw new Error('请输入当前密码。');
  if (currentPassword === nextPassword) throw new Error('新密码不能与当前密码相同。');
  return validatePassword(nextPassword);
}

export function normalizeEmailOtp(token: string): string {
  const normalized = token.replace(/\s/g, '');
  if (!/^\d{8}$/.test(normalized)) {
    throw new Error('请输入邮件中的 8 位数字验证码。');
  }

  return normalized;
}

export function normalizePhone(phone: string): string {
  const normalized = phone.replace(/[\s()-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) throw new Error('请输入包含国家区号的手机号，例如 +61412345678。');
  return normalized;
}

function authRedirectUrl(path = '/', inviteToken?: string) {
  const queryParams = inviteToken ? { invite: inviteToken } : undefined;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const url = new URL(path, window.location.origin);
    if (inviteToken) url.searchParams.set('invite', inviteToken);
    return url.toString();
  }
  return Linking.createURL(path, { queryParams });
}

async function finishNativeOAuth(url: string, redirectTo: string) {
  const browser = await WebBrowser.openAuthSessionAsync(url, redirectTo);
  if (browser.type !== 'success') return;
  const callback = new URL(browser.url);
  const code = callback.searchParams.get('code');
  if (code) {
    const { error } = await getSupabaseClient().auth.exchangeCodeForSession(code);
    if (error) throw error;
    return;
  }
  const hash = new URLSearchParams(callback.hash.slice(1));
  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error } = await getSupabaseClient().auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) throw error;
  }
}

export async function signInWithGoogle(inviteToken?: string) {
  const redirectTo = authRedirectUrl('/', inviteToken);
  const { data, error } = await getSupabaseClient().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: Platform.OS !== 'web' },
  });
  if (error) throw error;
  if (Platform.OS !== 'web' && data.url) await finishNativeOAuth(data.url, redirectTo);
}

export async function linkGoogleIdentity() {
  const redirectTo = authRedirectUrl('/profile');
  const { data, error } = await getSupabaseClient().auth.linkIdentity({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: Platform.OS !== 'web' },
  });
  if (error) throw error;
  if (Platform.OS !== 'web' && data.url) await finishNativeOAuth(data.url, redirectTo);
}

/**
 * Sends a recovery link. Always resolves, even for an address with no account:
 * confirming which emails are registered would leak account enumeration.
 *
 * The redirect target must be on Supabase Auth's allowed redirect list, or the
 * link drops the traveller on the Site URL with no session.
 */
export async function requestPasswordReset(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const redirectTo = authRedirectUrl('/reset-password');
  const { error } = await getSupabaseClient().auth.resetPasswordForEmail(normalizedEmail, { redirectTo });
  if (error && error.status !== 400) throw error;
  return normalizedEmail;
}

export async function signInWithPassword(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email: normalizedEmail, password });
  if (error) throw error;
  return data.session;
}

export async function sendEmailOtp(email: string, shouldCreateUser: boolean): Promise<string> {
  const normalizedEmail = normalizeEmail(email);
  const { error } = await getSupabaseClient().auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      shouldCreateUser,
    },
  });

  if (error) throw error;
  return normalizedEmail;
}

export async function sendPhoneOtp(phone: string, shouldCreateUser = true): Promise<string> {
  const normalizedPhone = normalizePhone(phone);
  const { error } = await getSupabaseClient().auth.signInWithOtp({ phone: normalizedPhone, options: { shouldCreateUser } });
  if (error) throw error;
  return normalizedPhone;
}

export async function completeRegistration(input: {
  userId: string;
  displayName: string;
  password?: string;
  avatar?: { uri: string; mimeType?: string | null };
}) {
  const displayName = input.displayName.trim();
  if (!displayName || displayName.length > 80) throw new Error('请输入 1 到 80 个字符的显示名称。');
  const client = getSupabaseClient();
  const password = input.password ? validatePassword(input.password) : undefined;
  const { error } = await client.auth.updateUser({ ...(password ? { password } : {}), data: { display_name: displayName } });
  if (error) throw error;
  await updateProfile(input.userId, {
    displayName,
    avatar: input.avatar,
  });
  const { error: onboardingError } = await client.rpc('complete_profile_onboarding');
  if (onboardingError) throw onboardingError;
}


export async function verifyEmailOtp(email: string, token: string) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedToken = normalizeEmailOtp(token);

  const { data, error } = await getSupabaseClient().auth.verifyOtp({
    email: normalizedEmail,
    token: normalizedToken,
    type: 'email',
  });

  if (error) throw error;
  return data.session;
}

export async function verifyPhoneOtp(phone: string, token: string) {
  const normalizedPhone = normalizePhone(phone);
  const normalizedToken = normalizeEmailOtp(token);
  const { data, error } = await getSupabaseClient().auth.verifyOtp({ phone: normalizedPhone, token: normalizedToken, type: 'sms' });
  if (error) throw error;
  return data.session;
}

export async function beginEmailLink(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const { error } = await getSupabaseClient().auth.updateUser({ email: normalizedEmail });
  if (error) throw error;
  return normalizedEmail;
}

export async function verifyEmailLink(email: string, token: string) {
  const { error } = await getSupabaseClient().auth.verifyOtp({ email: normalizeEmail(email), token: normalizeEmailOtp(token), type: 'email_change' });
  if (error) throw error;
}

export async function beginPhoneLink(phone: string) {
  const normalizedPhone = normalizePhone(phone);
  const { error } = await getSupabaseClient().auth.updateUser({ phone: normalizedPhone });
  if (error) throw error;
  return normalizedPhone;
}

export async function verifyPhoneLink(phone: string, token: string) {
  const { error } = await getSupabaseClient().auth.verifyOtp({ phone: normalizePhone(phone), token: normalizeEmailOtp(token), type: 'phone_change' });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) throw error;
}

export async function deleteAccount() {
  const client = getSupabaseClient();
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('avatar_path')
    .single();
  if (profileError) throw profileError;

  if (profile.avatar_path) {
    const { error: avatarError } = await client.storage.from('avatars').remove([profile.avatar_path]);
    if (avatarError) throw avatarError;
  }

  const { error } = await client.rpc('delete_current_account');
  if (error) throw error;

  const { error: signOutError } = await client.auth.signOut({ scope: 'local' });
  if (signOutError) throw signOutError;
}

/**
 * Supabase accepts a new password on the strength of the session alone, so a
 * borrowed or hijacked session could otherwise take the account over.
 * Re-authenticate with the current password first.
 *
 * The re-authentication issues a fresh session for the same user; the auth
 * provider treats a repeat SIGNED_IN for an unchanged identity as a no-op, so
 * the mounted product survives it.
 */
export async function changePassword(currentPassword: string, nextPassword: string) {
  const password = assertPasswordChange(currentPassword, nextPassword);
  const client = getSupabaseClient();
  const { data, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  const email = data.user?.email;
  if (!email) throw new Error('当前账号没有邮箱，无法验证身份。');

  const { error: reauthError } = await client.auth.signInWithPassword({ email, password: currentPassword });
  if (reauthError) throw new Error('当前密码不正确。');

  const { error } = await client.auth.updateUser({ password });
  if (error) throw error;
}

/**
 * For accounts created through a provider, which have no password to
 * re-authenticate against. Possession of the signed-in session is the only
 * proof available, and it is the same proof the provider already accepted.
 */
export async function setInitialPassword(nextPassword: string) {
  const password = validatePassword(nextPassword);
  const { error } = await getSupabaseClient().auth.updateUser({ password });
  if (error) throw error;
}
