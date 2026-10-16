import type { ItineraryItem } from '@/domain/models';
import { buildDayBriefing } from '@/features/itinerary/day-briefing';

const tz = 'Asia/Tokyo';
const plan = (id: string, kind: ItineraryItem['kind'], startsAt: string, endsAt: string): ItineraryItem =>
  ({ id, tripId: 't', kind, title: id, startsAt, endsAt, routeTravelMode: 'WALK' });

// Times in UTC; Tokyo is UTC+9.
const hotelA = plan('Hotel A', 'lodging', '2026-11-13T06:00:00Z', '2026-11-14T02:00:00Z');
const train = plan('Train', 'transport', '2026-11-13T23:30:00Z', '2026-11-14T02:00:00Z');
const lunch = plan('Lunch', 'food', '2026-11-14T03:00:00Z', '2026-11-14T04:00:00Z');
const hotelB = plan('Hotel B', 'lodging', '2026-11-14T06:00:00Z', '2026-11-16T02:00:00Z');
const dinner = plan('Dinner', 'food', '2026-11-14T10:00:00Z', '2026-11-14T11:30:00Z');
const items = [hotelA, train, lunch, hotelB, dinner];

test('the evening before, it briefs tomorrow: when the day ends, check-out and check-in', () => {
  const briefing = buildDayBriefing(items, new Date('2026-11-13T12:00:00Z'), tz);
  expect(briefing).toEqual({
    date: '2026-11-14',
    relative: 'tomorrow',
    planCount: 3,
    last: { time: '20:30', title: 'Dinner' },
    checkOuts: [{ time: '11:00', title: 'Hotel A' }],
    checkIns: [{ time: '15:00', title: 'Hotel B' }],
  });
});

test('during the day it briefs only what is still ahead today', () => {
  const briefing = buildDayBriefing(items, new Date('2026-11-14T05:00:00Z'), tz);
  expect(briefing).toMatchObject({ date: '2026-11-14', relative: 'today', planCount: 1, last: { time: '20:30', title: 'Dinner' }, checkOuts: [], checkIns: [{ time: '15:00', title: 'Hotel B' }] });
});

test('before the trip it briefs the first day with a date', () => {
  expect(buildDayBriefing(items, new Date('2026-11-01T00:00:00Z'), tz)).toMatchObject({ date: '2026-11-13', relative: 'later', planCount: 0, checkIns: [{ time: '15:00', title: 'Hotel A' }] });
});

test('after the last plan there is nothing to brief', () => {
  expect(buildDayBriefing(items, new Date('2026-11-17T00:00:00Z'), tz)).toBeUndefined();
});

test.each([
  ['spring forward', '2026-10-03T13:30:00Z', '2026-10-03T23:00:00Z', '2026-10-04'],
  ['fall back', '2026-04-04T13:30:00Z', '2026-04-06T00:00:00Z', '2026-04-06'],
])('tomorrow is the next local calendar date across %s', (_, now, start, date) => {
  expect(buildDayBriefing([plan('Visit', 'activity', start, start)], new Date(now), 'Australia/Sydney'))
    .toMatchObject({ date, relative: 'tomorrow' });
});

test('the final plan is selected by instant even when ISO offsets differ', () => {
  const offsetItems = [
    plan('Early', 'activity', '2026-11-14T10:00:00+09:00', '2026-11-14T20:00:00+09:00'),
    plan('Late', 'activity', '2026-11-14T02:00:00Z', '2026-11-14T12:00:00Z'),
  ];
  expect(buildDayBriefing(offsetItems, new Date('2026-11-14T00:00:00Z'), tz)?.last)
    .toEqual({ time: '21:00', title: 'Late' });
});

test('check-in and check-out boundaries expire as the shared clock advances', () => {
  const stay = plan('Hotel', 'lodging', '2026-11-14T06:00:00Z', '2026-11-15T02:00:00Z');
  expect(buildDayBriefing([stay], new Date('2026-11-14T06:00:00Z'), tz))
    .toMatchObject({ relative: 'today', checkIns: [{ time: '15:00', title: 'Hotel' }] });
  expect(buildDayBriefing([stay], new Date('2026-11-14T06:01:00Z'), tz))
    .toMatchObject({ relative: 'tomorrow', checkIns: [], checkOuts: [{ time: '11:00', title: 'Hotel' }] });
  expect(buildDayBriefing([stay], new Date('2026-11-15T02:01:00Z'), tz)).toBeUndefined();
});

test('an overnight final plan includes its end date instead of implying an earlier finish', () => {
  const overnight = plan('Night train', 'transport', '2026-11-14T14:00:00Z', '2026-11-14T17:00:00Z');
  expect(buildDayBriefing([overnight], new Date('2026-11-14T12:00:00Z'), tz)?.last)
    .toEqual({ time: '02:00', title: 'Night train', date: '2026-11-15' });
});
