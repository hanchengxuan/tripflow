import { tripPhase } from '@/features/trips/trip-phase';

const trip = { startsOn: '2026-10-20', endsOn: '2026-10-25', defaultTimeZone: 'Asia/Tokyo' };

test('a trip that starts later is upcoming, not in progress', () => {
  expect(tripPhase(trip, new Date('2026-10-15T12:00:00Z'))).toBe('upcoming');
});

test('the first and last days count as in progress', () => {
  expect(tripPhase(trip, new Date('2026-10-20T00:30:00+09:00'))).toBe('ongoing');
  expect(tripPhase(trip, new Date('2026-10-25T23:30:00+09:00'))).toBe('ongoing');
});

test('a trip whose last day has passed is ended', () => {
  expect(tripPhase(trip, new Date('2026-10-26T00:30:00+09:00'))).toBe('ended');
});

test('the phase follows the trip time zone, not the device clock', () => {
  // 2026-10-19 16:00 UTC is already 2026-10-20 01:00 in Tokyo.
  expect(tripPhase(trip, new Date('2026-10-19T16:00:00Z'))).toBe('ongoing');
});
