import { getSupabaseClient } from '@/lib/supabase';
import * as Linking from 'expo-linking';

export function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();

  if (!normalized || !normalized.includes('@')) {
    throw new Error('Enter a valid email address.');
  }

  return normalized;
}

export async function sendEmailOtp(email: string): Promise<string> {
  const normalizedEmail = normalizeEmail(email);
  const { error } = await getSupabaseClient().auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: Linking.createURL('/'),
    },
  });

  if (error) throw error;
  return normalizedEmail;
}

export async function verifyEmailOtp(email: string, token: string) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedToken = token.trim();

  if (!/^\d{6}$/.test(normalizedToken)) {
    throw new Error('Enter the six-digit code from your email.');
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
