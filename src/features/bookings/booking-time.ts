import type { BookingDraft } from '../../../supabase/functions/parse-booking/contract';
import { isoToZonedDateTime, zonedDateTimeToIso } from '@/lib/trip-time';
import type { Trip } from '@/domain/models';

export function bookingLocalToIso(local: string, timeZone: string) {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(local) || !timeZone) throw new Error('Complete the local date, time, and time zone.');
  const [date, time] = local.split(' ');
  const iso = zonedDateTimeToIso(date, time, timeZone);
  const roundTrip = (value: string) => {
    const parts = isoToZonedDateTime(value, timeZone);
    return `${parts.date} ${parts.time}`;
  };
  if (roundTrip(iso) !== local) throw new Error('This local date or time does not exist.');
  for (const offset of [-120, -60, -30, 30, 60, 120]) {
    if (roundTrip(new Date(new Date(iso).getTime() + offset * 60_000).toISOString()) === local) throw new Error('This time is ambiguous because of daylight saving. Confirm a different time.');
  }
  return iso;
}

export function bookingToPlan(draft: BookingDraft, trip: Trip) {
  if (!draft.title.trim() || draft.title.trim().length > 180 || !draft.location.trim()) throw new Error('Complete the booking title and location.');
  const startsAt = bookingLocalToIso(draft.startLocal, draft.startTimeZone);
  const endsAt = bookingLocalToIso(draft.endLocal, draft.endTimeZone);
  if (endsAt <= startsAt) throw new Error('The end must be after the start.');
  const startDate = isoToZonedDateTime(startsAt, trip.defaultTimeZone).date;
  const endDate = isoToZonedDateTime(endsAt, trip.defaultTimeZone).date;
  if (startDate < trip.startsOn || endDate > trip.endsOn) throw new Error('Update the trip dates or correct this booking before importing.');
  return {
    title: draft.title.trim(),
    kind: draft.kind === 'hotel' ? 'lodging' as const : 'transport' as const,
    startsAt,
    endsAt,
    locationLabel: draft.location.trim(),
  };
}
