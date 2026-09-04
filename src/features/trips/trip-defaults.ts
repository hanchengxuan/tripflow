import type { ItineraryItem, Trip } from '@/domain/models';

/**
 * Where a trip's time zone and its ledger's base currency come from.
 *
 * Neither is a question the traveller is asked. A time zone can always be
 * derived — every destination carries one from the geocoder, and the device
 * knows its own — so asking for an IANA zone name was asking a question the
 * app could answer. A base currency is not a property of the trip at all: it
 * belongs to the ledger, which is where it is now set, and it stops being
 * changeable once money has been recorded against it.
 */

/** The device's zone. Falls back to UTC where `Intl` has no answer. */
export function deviceTimeZone(): string {
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return resolved && resolved.length > 0 ? resolved : 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * The zone a trip's own times are read in — the one used for a plan that has
 * no destination of its own, and for the trip's dates.
 *
 * The earliest plan with a destination wins: that is where the trip starts, so
 * it is the zone its dates are most likely meant in. Failing that, whatever was
 * stored when the trip was created, and failing that the device.
 */
export function tripTimeZone(
  trip: Pick<Trip, 'defaultTimeZone'> | undefined,
  items: readonly Pick<ItineraryItem, 'startsAt' | 'destination'>[] = [],
): string {
  const earliest = [...items]
    .filter((item) => item.destination?.timeZone)
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt))[0];
  if (earliest?.destination?.timeZone) return earliest.destination.timeZone;
  const stored = trip?.defaultTimeZone?.trim();
  return stored && stored.length > 0 ? stored : deviceTimeZone();
}

/**
 * The zone to stamp on a trip as it is created. A destination chosen in the
 * form decides it; otherwise the device does. It is only ever a fallback —
 * `tripTimeZone` prefers the itinerary once there is one.
 */
export function newTripTimeZone(destinationTimeZone?: string) {
  const chosen = destinationTimeZone?.trim();
  return chosen && chosen.length > 0 ? chosen : deviceTimeZone();
}

/**
 * The currency a new trip's ledger starts in.
 *
 * A group's second trip is overwhelmingly settled in the same currency as its
 * first, and that beats any guess derived from where they happen to be going.
 * Trips are listed most recent first, so the first one with a currency wins.
 */
export function defaultHomeCurrency(trips: readonly Pick<Trip, 'homeCurrency'>[], fallback = 'USD') {
  for (const trip of trips) {
    const currency = trip.homeCurrency?.trim().toUpperCase();
    if (currency) return currency;
  }
  return fallback;
}

/**
 * Whether the ledger's base currency can still be changed.
 *
 * `record_expense` validates every expense against `trips.home_currency` and
 * stores a `base_amount_minor` converted at the rate of the day.
 * `update_trip_details` recomputes none of that, so changing the base after
 * money exists would leave every stored base amount denominated in the old
 * currency while the ledger sums and settles them as the new one. The only
 * safe moment is before the first expense.
 */
export function canChangeBaseCurrency(expenseCount: number) {
  return expenseCount === 0;
}
