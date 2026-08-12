import { getSupabaseClient } from '@/lib/supabase';
import * as Linking from 'expo-linking';

import { parseInviteToken } from '@/features/invites/invite-link';

export function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();

  if (!normalized || !normalized.includes('@')) {
    throw new Error('请输入有效的邮箱地址。');
  }

  return normalized;
}

export async function sendEmailOtp(email: string): Promise<string> {
  const normalizedEmail = normalizeEmail(email);
  const initialUrl = await Linking.getInitialURL();
  const emailRedirectTo = initialUrl && parseInviteToken(initialUrl) ? initialUrl : Linking.createURL('/');
  const { error } = await getSupabaseClient().auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      shouldCreateUser: true,
      emailRedirectTo,
    },
  });

  if (error) throw error;
  return normalizedEmail;
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
