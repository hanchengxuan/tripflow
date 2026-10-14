import { bookingLocalToIso, bookingToPlan } from '../booking-time';
import { decodeBookingFile, sanitizeBookings } from '../../../../supabase/functions/parse-booking/contract';

const trip = { id: 'trip', createdBy: 'owner', name: 'Demo', startsOn: '2026-10-20', endsOn: '2026-10-25', homeCurrency: 'JPY', defaultTimeZone: 'Asia/Tokyo' };
const draft = { kind: 'flight' as const, title: 'QF25 SYD → HND', location: 'Haneda Airport', startLocal: '2026-10-20 20:30', endLocal: '2026-10-21 05:30', startTimeZone: 'Australia/Sydney', endTimeZone: 'Asia/Tokyo', flightNumber: 'QF25', departureAirport: 'SYD', arrivalAirport: 'HND', warnings: [] };

test('cross-zone overnight flight preserves both local times', () => {
  const plan = bookingToPlan(draft, trip);
  expect(plan.startsAt).toBe('2026-10-20T09:30:00.000Z');
  expect(plan.endsAt).toBe('2026-10-20T20:30:00.000Z');
});
test('a date-line flight can arrive on an earlier local date', () => {
  const plan = bookingToPlan({ ...draft, startLocal: '2026-10-21 12:00', endLocal: '2026-10-20 22:00', startTimeZone: 'Asia/Tokyo', endTimeZone: 'America/Los_Angeles' }, trip);
  expect(new Date(plan.endsAt).getTime()).toBeGreaterThan(new Date(plan.startsAt).getTime());
});
test('unknown dates and zones are not guessed', () => {
  expect(() => bookingToPlan({ ...draft, startLocal: '' }, trip)).toThrow();
  expect(() => bookingToPlan({ ...draft, endTimeZone: '' }, trip)).toThrow();
});
test('invalid calendar dates, DST gaps and ambiguous times are rejected', () => {
  expect(() => bookingLocalToIso('2026-02-30 10:00', 'Asia/Tokyo')).toThrow();
  expect(() => bookingLocalToIso('2026-03-08 02:30', 'America/New_York')).toThrow();
  expect(() => bookingLocalToIso('2026-11-01 01:30', 'America/New_York')).toThrow();
});
test('out-of-trip bookings require correction, never silently extend the trip', () => {
  expect(() => bookingToPlan({ ...draft, endLocal: '2026-10-26 10:00' }, trip)).toThrow();
});
test('a hotel creates one interval across several nights', () => {
  expect(bookingToPlan({ ...draft, kind: 'hotel', startLocal: '2026-10-21 15:00', endLocal: '2026-10-24 11:00', startTimeZone: 'Asia/Tokyo' }, trip).kind).toBe('lodging');
});
test('unsupported types, oversized output and spoofed file MIME are rejected', () => {
  expect(() => sanitizeBookings([{ kind: 'instruction' }])).toThrow();
  expect(() => sanitizeBookings(Array(13).fill(draft))).toThrow();
  expect(() => decodeBookingFile(btoa('fake'), 'application/pdf')).toThrow();
  expect(() => decodeBookingFile(btoa('%PDF-1.7\n'), 'image/png')).toThrow();
  expect(decodeBookingFile(btoa('%PDF-1.7\n'), 'application/pdf').bytes.length).toBe(9);
});
