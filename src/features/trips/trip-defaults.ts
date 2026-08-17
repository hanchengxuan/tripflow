import type { Trip } from '@/domain/models';

/**
 * Sensible starting values for a new trip, so creating one asks for a name and
 * dates rather than an IANA zone name.
 *
 * Both were previously hardcoded to Hong Kong, which was right for exactly one
 * traveller. Neither is a guess the traveller has to accept: choosing a
 * destination overwrites both, and the summary row stays editable.
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
 * The currency the traveller last chose to settle in. A group's second trip is
 * overwhelmingly settled in the same currency as its first, and that beats any
 * guess derived from where they happen to be going.
 */
export function defaultHomeCurrency(trips: readonly Pick<Trip, 'homeCurrency'>[], fallback = 'USD') {
  for (const trip of trips) {
    const currency = trip.homeCurrency?.trim().toUpperCase();
    if (currency) return currency;
  }
  return fallback;
}

/**
 * Trips are listed most recent first, so the same ordering decides the default
 * time zone: reuse the last trip's zone when there is one, otherwise the
 * device's.
 */
export function defaultTripTimeZone(trips: readonly Pick<Trip, 'defaultTimeZone'>[]) {
  for (const trip of trips) {
    const zone = trip.defaultTimeZone?.trim();
    if (zone) return zone;
  }
  return deviceTimeZone();
}
