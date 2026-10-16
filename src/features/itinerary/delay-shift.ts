import type { ItineraryItem, Trip } from '@/domain/models';
import { isoToZonedDateTime } from '@/lib/trip-time';

const minute = 60 * 1000;
const keptGapMs = 30 * minute;

export interface PlanShift {
  item: ItineraryItem;
  startsAt: string;
  endsAt: string;
}

export interface DelayShiftPlan {
  shifts: PlanShift[];
  /** A moved plan would start or end outside the trip dates. */
  outsideTrip: boolean;
  /** A hotel check-in would move past its check-out. */
  invalid: boolean;
}

const time = (value: string) => new Date(value).getTime();
const iso = (value: number) => new Date(value).toISOString();

/**
 * Moves a delayed plan later by `delayMinutes` and pushes the plans after it only as far as
 * needed, keeping up to 30 minutes of each original gap. Hotels never act as a blocker; a
 * hotel's check-in follows its linked transfer and its check-out never moves.
 */
export function planDelayShift(
  items: ItineraryItem[],
  delayedItemId: string,
  delayMinutes: number,
  trip: Pick<Trip, 'startsOn' | 'endsOn' | 'defaultTimeZone'>,
): DelayShiftPlan {
  const delayed = items.find((item) => item.id === delayedItemId);
  if (!delayed || delayed.kind === 'lodging' || !Number.isFinite(delayMinutes) || delayMinutes <= 0) return { shifts: [], outsideTrip: false, invalid: false };

  const moved = new Map<string, { startsAt: number; endsAt: number }>();
  const endOf = (item: ItineraryItem) => time(item.endsAt ?? item.startsAt);
  const delta = delayMinutes * minute;
  moved.set(delayed.id, { startsAt: time(delayed.startsAt) + delta, endsAt: endOf(delayed) + delta });

  let previous = { originalEnd: endOf(delayed), newEnd: endOf(delayed) + delta };
  const following = items
    .filter((item) => item.id !== delayed.id && item.segmentId === delayed.segmentId && item.kind !== 'lodging' && time(item.startsAt) >= time(delayed.startsAt))
    .sort((left, right) => time(left.startsAt) - time(right.startsAt));
  for (const item of following) {
    const start = time(item.startsAt);
    const end = endOf(item);
    const required = previous.newEnd + Math.min(Math.max(0, start - previous.originalEnd), keptGapMs);
    const push = Math.max(0, required - start);
    if (push > 0) moved.set(item.id, { startsAt: start + push, endsAt: end + push });
    if (end + push > previous.newEnd) previous = { originalEnd: end, newEnd: end + push };
  }

  let invalid = false;
  for (const transfer of items) {
    const shifted = transfer.linkedStayId ? moved.get(transfer.id) : undefined;
    const stay = items.find((item) => item.id === transfer.linkedStayId);
    if (!shifted || !stay?.endsAt) continue;
    if (shifted.endsAt >= time(stay.endsAt)) invalid = true;
    moved.set(stay.id, { startsAt: shifted.endsAt, endsAt: time(stay.endsAt) });
  }

  const shifts = items
    .filter((item) => moved.has(item.id))
    .map((item) => ({ item, startsAt: iso(moved.get(item.id)!.startsAt), endsAt: iso(moved.get(item.id)!.endsAt) }));
  const dateOf = (value: string) => isoToZonedDateTime(value, trip.defaultTimeZone).date;
  const outsideTrip = shifts.some(({ startsAt, endsAt }) => dateOf(startsAt) < trip.startsOn || dateOf(endsAt) > trip.endsOn);
  return { shifts, outsideTrip, invalid };
}
