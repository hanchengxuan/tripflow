import type { ItineraryItem } from '@/domain/models';
import type { ItineraryHealthIssue } from '@/features/ai/itinerary-health';
import { suggestHealthFix } from '@/features/ai/itinerary-health-fix';

const trip = { startsOn: '2026-10-20', endsOn: '2026-10-25', defaultTimeZone: 'Asia/Tokyo' };
const transfer = { id: 'transfer', tripId: 't', kind: 'transport', title: 'Airport transfer', startsAt: '2026-10-21T04:30:00Z', endsAt: '2026-10-21T06:00:00Z' } as ItineraryItem;
const museum = { id: 'museum', tripId: 't', kind: 'activity', title: 'Museum', startsAt: '2026-10-21T06:10:00Z', endsAt: '2026-10-21T08:00:00Z' } as ItineraryItem;
const hotel = { id: 'hotel', tripId: 't', kind: 'lodging', title: 'Hotel', startsAt: '2026-10-21T06:00:00Z', endsAt: '2026-10-24T02:00:00Z' } as ItineraryItem;
const issue = (type: ItineraryHealthIssue['type'], itemIds: string[]) => ({ id: 'x', type, severity: 'warning', itemIds, title: '', reason: '', confidence: 1 }) as ItineraryHealthIssue;

test('a tight gap moves the later plan to start 30 minutes after the earlier one ends, keeping its length', () => {
  const fix = suggestHealthFix(issue('BUFFER', ['transfer', 'museum']), [transfer, museum], trip);
  expect(fix?.candidate).toMatchObject({ id: 'museum', startsAt: '2026-10-21T06:30:00.000Z', endsAt: '2026-10-21T08:20:00.000Z' });
});

test('an overlap is resolved the same way', () => {
  const overlapping = { ...museum, startsAt: '2026-10-21T05:30:00Z' };
  const fix = suggestHealthFix(issue('CONFLICT', ['transfer', 'museum']), [transfer, overlapping], trip);
  expect(fix?.candidate).toMatchObject({ startsAt: '2026-10-21T06:30:00.000Z', endsAt: '2026-10-21T09:00:00.000Z' });
});

test('a later hotel check-in keeps its check-out', () => {
  const fix = suggestHealthFix(issue('BUFFER', ['transfer', 'hotel']), [transfer, hotel], trip);
  expect(fix?.candidate).toMatchObject({ startsAt: '2026-10-21T06:30:00.000Z', endsAt: '2026-10-24T02:00:00.000Z' });
});

test('no fix is offered when moving the plan would collide with the next one', () => {
  const next = { id: 'next', tripId: 't', kind: 'food', title: 'Lunch', startsAt: '2026-10-21T08:10:00Z', endsAt: '2026-10-21T09:00:00Z' } as ItineraryItem;
  expect(suggestHealthFix(issue('BUFFER', ['transfer', 'museum']), [transfer, museum, next], trip)).toBeUndefined();
});

test('no fix is offered when the move would leave the trip dates', () => {
  const lastNight = { ...transfer, startsAt: '2026-10-25T13:00:00Z', endsAt: '2026-10-25T14:50:00Z' };
  const late = { ...museum, startsAt: '2026-10-25T14:55:00Z', endsAt: '2026-10-25T14:58:00Z' };
  expect(suggestHealthFix(issue('BUFFER', ['transfer', 'museum']), [lastNight, late], trip)).toBeUndefined();
});

test('issues that are not about timing get no automatic fix', () => {
  expect(suggestHealthFix(issue('MISSING_LOCATION', ['museum']), [museum], trip)).toBeUndefined();
  expect(suggestHealthFix(issue('DENSE_DAY', ['transfer', 'museum']), [transfer, museum], trip)).toBeUndefined();
});
