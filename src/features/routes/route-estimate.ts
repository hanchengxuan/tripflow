import { getSupabaseClient } from '@/lib/supabase';

export interface RouteEstimate {
  distanceMeters: number;
  durationSeconds: number;
}

const estimateCache = new Map<string, Promise<RouteEstimate | null>>();

export function getRouteEstimate(tripId: string, originPlaceId: string, destinationPlaceId: string) {
  const key = `${tripId}:${originPlaceId}:${destinationPlaceId}`;
  const cached = estimateCache.get(key);
  if (cached) return cached;

  const request = getSupabaseClient().functions.invoke('route-estimate', {
    body: { tripId, originPlaceId, destinationPlaceId },
  }).then(({ data, error }) => {
    if (error) throw error;
    return data?.route as RouteEstimate | null;
  }).catch((error) => {
    estimateCache.delete(key);
    throw error;
  });
  estimateCache.set(key, request);
  return request;
}
