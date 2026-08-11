import { getSupabaseClient } from '@/lib/supabase';

export interface PlaceSuggestion {
  placeId: string;
  text: string;
  mainText: string;
  secondaryText: string;
}

export async function searchPlaces(input: string, locale: string, sessionToken: string) {
  const { data, error } = await getSupabaseClient().functions.invoke('places-autocomplete', {
    body: { input, locale, sessionToken },
  });
  if (error) throw error;
  return Array.isArray(data?.suggestions) ? data.suggestions as PlaceSuggestion[] : [];
}
