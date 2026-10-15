import type { ItineraryItem, Trip } from '@/domain/models';
import type { ItineraryHealthIssue } from '@/features/ai/itinerary-health';
import { isoToZonedDateTime } from '@/lib/trip-time';

const bufferMs = 30 * 60 * 1000;

export interface HealthFix {
  before: ItineraryItem;
  candidate: ItineraryItem & { endsAt: string };
}

function interval(item: ItineraryItem) {
  const startsAt = new Date(item.startsAt).getTime();
  return { startsAt, endsAt: item.endsAt ? new Date(item.endsAt).getTime() : startsAt };
}

function fitsSchedule(
  candidate: ItineraryItem & { endsAt: string },
  items: ItineraryItem[],
  trip: Pick<Trip, 'startsOn' | 'endsOn' | 'defaultTimeZone'>,
) {
  const moved = interval(candidate);
  if (!(moved.endsAt > moved.startsAt)) return false;
  const startDate = isoToZonedDateTime(candidate.startsAt, trip.defaultTimeZone).date;
  const endDate = isoToZonedDateTime(candidate.endsAt, trip.defaultTimeZone).date;
  if (startDate < trip.startsOn || endDate > trip.endsOn) return false;
  return !items.some((item) => {
    if (item.id === candidate.id || !item.endsAt) return false;
    const other = interval(item);
    return moved.startsAt < other.endsAt && moved.endsAt > other.startsAt;
  });
}

/** Moves the later plan of a tight gap or overlap to start 30 minutes after the earlier one ends. */
export function suggestHealthFix(
  issue: ItineraryHealthIssue,
  items: ItineraryItem[],
  trip: Pick<Trip, 'startsOn' | 'endsOn' | 'defaultTimeZone'>,
): HealthFix | undefined {
  if (issue.type !== 'BUFFER' && issue.type !== 'CONFLICT') return undefined;
  const [earlier, later] = issue.itemIds.map((id) => items.find((item) => item.id === id));
  if (!earlier?.endsAt || !later?.endsAt) return undefined;

  const startsAtMs = new Date(earlier.endsAt).getTime() + bufferMs;
  const durationMs = new Date(later.endsAt).getTime() - new Date(later.startsAt).getTime();
  const candidate = {
    ...later,
    startsAt: new Date(startsAtMs).toISOString(),
    endsAt: later.kind === 'lodging' ? new Date(later.endsAt).toISOString() : new Date(startsAtMs + durationMs).toISOString(),
  };
  return fitsSchedule(candidate, items, trip) ? { before: later, candidate } : undefined;
}
