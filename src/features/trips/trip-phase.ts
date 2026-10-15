import type { Trip } from '@/domain/models';

export type TripPhase = 'upcoming' | 'ongoing' | 'ended';

export function tripPhase(trip: Pick<Trip, 'startsOn' | 'endsOn' | 'defaultTimeZone'>, now: Date): TripPhase {
  // en-CA formats as YYYY-MM-DD, which compares correctly against the stored trip dates.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: trip.defaultTimeZone }).format(now);
  if (today < trip.startsOn) return 'upcoming';
  if (today > trip.endsOn) return 'ended';
  return 'ongoing';
}
