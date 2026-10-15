import type { ItineraryItem, Trip } from '@/domain/models';
import { validateMergedItineraryEdit } from '@/features/ai/itinerary-edit';
import type { ItineraryHealthIssue } from '@/features/ai/itinerary-health';

const bufferMs = 30 * 60 * 1000;

export interface HealthFix {
  before: ItineraryItem;
  candidate: ItineraryItem & { endsAt: string };
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
  const validation = validateMergedItineraryEdit({ candidate, items, trip, timeZone: trip.defaultTimeZone });
  return validation.errors.length === 0 ? { before: later, candidate } : undefined;
}
