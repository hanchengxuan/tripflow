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

/** A finished lookup: an estimate, Google found no route for that mode, or the request failed. */
export type RouteLookup = RouteEstimate | 'no-route' | 'failed';

export type RouteEstimateState =
  | { status: 'needs-places' }
  | { status: 'loading' }
  | { status: 'no-route' }
  | { status: 'failed' }
  | { status: 'ready'; estimate: RouteEstimate };

/** A lookup only runs when both ends are Google places; typed addresses alone never produce an estimate. */
export function routeEstimateState(
  previous: { googlePlaceId?: string },
  item: { id: string; googlePlaceId?: string },
  lookups: Record<string, RouteLookup>,
): RouteEstimateState {
  if (!previous.googlePlaceId || !item.googlePlaceId) return { status: 'needs-places' };
  const lookup = lookups[item.id];
  if (!lookup) return { status: 'loading' };
  return typeof lookup === 'string' ? { status: lookup } : { status: 'ready', estimate: lookup };
}
