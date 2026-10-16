import { getSupabaseClient } from '@/lib/supabase';

/** Calls an Edge Function and surfaces its readable Chinese error message instead of the generic non-2xx error. */
export async function invokeEdgeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabaseClient().functions.invoke(name, { body });
  if (error) {
    const response = (error as { context?: Response }).context;
    if (response) {
      try {
        const payload = await response.clone().json() as { error?: unknown };
        if (typeof payload.error === 'string') throw new Error(payload.error);
      } catch (caught) {
        if (caught instanceof Error && /[㐀-鿿]/u.test(caught.message)) throw caught;
      }
    }
    throw error;
  }
  return data as T;
}
