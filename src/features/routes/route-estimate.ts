import { getSupabaseClient } from '@/lib/supabase';
import type { RouteTravelMode } from '@/domain/models';

export interface RouteEstimate {
  distanceMeters: number;
  durationSeconds: number;
}

const estimateCache = new Map<string, Promise<RouteEstimate | null>>();

export function getRouteEstimate(tripId: string, originPlaceId: string, destinationPlaceId: string, travelMode: RouteTravelMode) {
  const key = `${tripId}:${originPlaceId}:${destinationPlaceId}:${travelMode}`;
  const cached = estimateCache.get(key);
  if (cached) return cached;

  const request = getSupabaseClient().functions.invoke('route-estimate', {
    body: { tripId, originPlaceId, destinationPlaceId, travelMode },
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
