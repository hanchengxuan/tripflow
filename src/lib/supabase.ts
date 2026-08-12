import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import type { Database } from '@/types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let client: SupabaseClient<Database> | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export interface AuthCapabilities { google: boolean; phone: boolean }

export async function getAuthCapabilities(): Promise<AuthCapabilities> {
  if (!supabaseUrl || !supabasePublishableKey) return { google: false, phone: false };
  const response = await fetch(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: supabasePublishableKey } });
  if (!response.ok) return { google: false, phone: false };
  const settings = await response.json() as { external?: Record<string, boolean> };
  return { google: Boolean(settings.external?.google), phone: Boolean(settings.external?.phone) };
}

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
    );
  }

  client ??= createClient<Database>(supabaseUrl, supabasePublishableKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  });

  return client;
}
