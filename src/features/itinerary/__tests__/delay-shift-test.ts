import type { ItineraryItem } from '@/domain/models';
import { planDelayShift } from '@/features/itinerary/delay-shift';

const trip = { startsOn: '2026-10-20', endsOn: '2026-10-25', defaultTimeZone: 'Asia/Tokyo' };
const plan = (id: string, kind: ItineraryItem['kind'], startsAt: string, endsAt: string, extra: Partial<ItineraryItem> = {}) =>
  ({ id, tripId: 't', kind, title: id, startsAt, endsAt, routeTravelMode: 'DRIVE', ...extra }) satisfies ItineraryItem;

// Times in UTC; Tokyo is UTC+9.
const flight = plan('flight', 'transport', '2026-10-20T09:30:00Z', '2026-10-20T20:30:00Z');
const transfer = plan('transfer', 'transport', '2026-10-20T21:00:00Z', '2026-10-20T22:00:00Z', { linkedStayId: 'hotel' });
const hotel = plan('hotel', 'lodging', '2026-10-20T22:00:00Z', '2026-10-23T02:00:00Z');
const lunch = plan('lunch', 'food', '2026-10-21T03:00:00Z', '2026-10-21T04:00:00Z');
const museum = plan('museum', 'activity', '2026-10-21T04:30:00Z', '2026-10-21T06:00:00Z');
const breakfast = plan('breakfast', 'food', '2026-10-20T00:00:00Z', '2026-10-20T01:00:00Z');
const items = [breakfast, flight, transfer, hotel, lunch, museum];

const moved = (result: ReturnType<typeof planDelayShift>) => Object.fromEntries(result.shifts.map(({ item, startsAt, endsAt }) => [item.id, [startsAt, endsAt]]));

test('a delayed flight pushes the transfer and hotel check-in, while later slack absorbs it', () => {
  const result = planDelayShift(items, 'flight', 120, trip);
  expect(moved(result)).toEqual({
    flight: ['2026-10-20T11:30:00.000Z', '2026-10-20T22:30:00.000Z'],
    transfer: ['2026-10-20T23:00:00.000Z', '2026-10-21T00:00:00.000Z'],
    hotel: ['2026-10-21T00:00:00.000Z', '2026-10-23T02:00:00.000Z'],
  });
  expect(result.outsideTrip).toBe(false);
});

test('a later plan moves only as far as needed, keeping up to 30 minutes of its gap', () => {
  const result = planDelayShift(items, 'lunch', 90, trip);
  expect(moved(result)).toEqual({
    lunch: ['2026-10-21T04:30:00.000Z', '2026-10-21T05:30:00.000Z'],
    museum: ['2026-10-21T06:00:00.000Z', '2026-10-21T07:30:00.000Z'],
  });
});

test('plans before the delayed one never move', () => {
  expect(moved(planDelayShift(items, 'flight', 600, trip))).not.toHaveProperty('breakfast');
});

test('a hotel without a moved transfer keeps its check-in', () => {
  const plain = [flight, { ...hotel, id: 'plain-hotel' }];
  expect(moved(planDelayShift(plain, 'flight', 120, trip))).toEqual({
    flight: ['2026-10-20T11:30:00.000Z', '2026-10-20T22:30:00.000Z'],
  });
});

test('a shift past the last trip day is flagged', () => {
  const late = plan('late', 'activity', '2026-10-25T13:00:00Z', '2026-10-25T14:00:00Z');
  expect(planDelayShift([late], 'late', 120, trip).outsideTrip).toBe(true);
});

test('a hotel pushed past its own check-out is flagged as impossible', () => {
  const shortStay = { ...hotel, endsAt: '2026-10-20T23:00:00Z' };
  expect(planDelayShift([flight, transfer, shortStay], 'flight', 120, trip).invalid).toBe(true);
});


test('parallel branches do not delay one another', () => {
  const branchLunch = { ...lunch, segmentId: 'branch-a' };
  const otherMuseum = { ...museum, segmentId: 'branch-b' };
  expect(moved(planDelayShift([branchLunch, otherMuseum], 'lunch', 90, trip))).not.toHaveProperty('museum');
});

test('trip boundary uses the trip timezone across daylight saving', () => {
  const item = plan('late', 'activity', '2026-10-24T12:00:00Z', '2026-10-24T12:30:00Z');
  const sydney = { startsOn: '2026-10-24', endsOn: '2026-10-24', defaultTimeZone: 'Australia/Sydney' };
  expect(planDelayShift([item], 'late', 15, sydney).outsideTrip).toBe(false);
  expect(planDelayShift([item], 'late', 60, sydney).outsideTrip).toBe(true);
});

test('a non-finite delay and a directly selected stay produce no changes', () => {
  expect(planDelayShift(items, 'flight', Number.NaN, trip).shifts).toEqual([]);
  expect(planDelayShift(items, 'hotel', 60, trip).shifts).toEqual([]);
});
