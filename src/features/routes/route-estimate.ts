import { getSupabaseClient } from '@/lib/supabase';
import type { RouteTravelMode } from '@/domain/models';

export interface RouteEstimate {
  distanceMeters: number;
  durationSeconds: number;
  transit?: {
    walking: { distanceMeters: number; durationSeconds: number };
    steps: TransitRouteStep[];
  };
}

export interface TransitRouteStep {
  departureTime?: string;
  arrivalTime?: string;
  departureTimeText?: string;
  arrivalTimeText?: string;
  departureStop: string;
  arrivalStop: string;
  lineName: string;
  vehicleName: string;
  vehicleType: string;
  headsign: string;
  stopCount: number;
  durationSeconds: number;
}

const estimateCache = new Map<string, Promise<RouteEstimate | null>>();

export function getRouteEstimate(tripId: string, originPlaceId: string, destinationPlaceId: string, travelMode: RouteTravelMode, departureTime?: string) {
  const key = `${tripId}:${originPlaceId}:${destinationPlaceId}:${travelMode}:${departureTime ?? ''}`;
  const cached = estimateCache.get(key);
  if (cached) return cached;

  const request = getSupabaseClient().functions.invoke('route-estimate', {
    body: { tripId, originPlaceId, destinationPlaceId, travelMode, departureTime },
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
