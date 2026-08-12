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

export async function completeRegistration(input: {
  userId: string;
  displayName: string;
  password: string;
  avatar?: { uri: string; mimeType?: string | null };
}) {
  const displayName = input.displayName.trim();
  if (!displayName || displayName.length > 80) throw new Error('请输入 1 到 80 个字符的显示名称。');
  const password = validatePassword(input.password);
  const client = getSupabaseClient();
  const { error } = await client.auth.updateUser({ password, data: { display_name: displayName } });
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
  const normalizedToken = token.trim();

  if (!/^\d{6}$/.test(normalizedToken)) {
    throw new Error('请输入邮件中的六位验证码。');
  }

  const { data, error } = await getSupabaseClient().auth.verifyOtp({
    email: normalizedEmail,
    token: normalizedToken,
    type: 'email',
  });

  if (error) throw error;
  return data.session;
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
