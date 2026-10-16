import type { ItineraryItem } from '@/domain/models';
import { planChangeFromAction, proposalsFromReply, validateTripChatReply } from '@/features/ai/trip-chat';

const trip = { defaultTimeZone: 'Asia/Tokyo' };
const lunch = { id: 'lunch', tripId: 't', kind: 'food', title: 'Lunch', startsAt: '2026-11-14T03:00:00Z', endsAt: '2026-11-14T04:00:00Z', routeTravelMode: 'WALK', locationLabel: 'Dotonbori' } as ItineraryItem;
const seoulDinner = { ...lunch, id: 'seoul', destination: { cityName: 'Seoul', countryName: 'Korea', countryCode: 'KR', timeZone: 'Asia/Seoul', currency: 'KRW', latitude: 1, longitude: 1 } } as ItineraryItem;

describe('validateTripChatReply', () => {
  test('keeps the answer and well-formed proposals for known plans and members', () => {
    const reply = validateTripChatReply({
      answer: 'OK',
      actions: [
        { type: 'update_plan', itemId: 'lunch', startLocal: '2026-11-14 13:00' },
        { type: 'add_expense', title: 'Taxi', amount: '2400', currency: 'JPY', payerUserId: 'me', participantUserIds: ['me', 'stranger'] },
      ],
    }, ['lunch'], ['me']);
    expect(reply).toEqual({
      answer: 'OK',
      actions: [
        { type: 'update_plan', itemId: 'lunch', startLocal: '2026-11-14 13:00' },
        { type: 'add_expense', title: 'Taxi', amount: '2400', currency: 'JPY', payerUserId: 'me', participantUserIds: ['me'] },
      ],
    });
  });

  test('drops proposals for unknown plans, bad times and unknown action types', () => {
    const reply = validateTripChatReply({
      answer: 'Hmm',
      actions: [
        { type: 'update_plan', itemId: 'ghost', startLocal: '2026-11-14 13:00' },
        { type: 'add_plan', kind: 'food', title: 'Dinner', startLocal: 'tonight', endLocal: '2026-11-14 20:00' },
        { type: 'delete_plan', itemId: 'lunch' },
      ],
    }, ['lunch'], ['me']);
    expect(reply.actions).toEqual([]);
  });

  test('rejects a reply with neither an answer nor a usable proposal', () => {
    expect(() => validateTripChatReply({ answer: ' ', actions: [] }, [], [])).toThrow();
  });
});

describe('planChangeFromAction', () => {
  test('moving the start keeps the plan length, in the trip time zone', () => {
    expect(planChangeFromAction({ type: 'update_plan', itemId: 'lunch', startLocal: '2026-11-14 13:00' }, lunch, trip)).toMatchObject({
      title: 'Lunch', startsAt: '2026-11-14T04:00:00.000Z', endsAt: '2026-11-14T05:00:00.000Z',
    });
  });

  test('an explicit end and a new title are applied as given', () => {
    expect(planChangeFromAction({ type: 'update_plan', itemId: 'lunch', title: 'Ramen', endLocal: '2026-11-14 14:30' }, lunch, trip)).toMatchObject({
      title: 'Ramen', startsAt: '2026-11-14T03:00:00.000Z', endsAt: '2026-11-14T05:30:00.000Z',
    });
  });

  test('a plan with its own destination uses that time zone', () => {
    expect(planChangeFromAction({ type: 'update_plan', itemId: 'seoul', startLocal: '2026-11-14 19:00' }, seoulDinner, trip).startsAt).toBe('2026-11-14T10:00:00.000Z');
  });

  test('an end before the start is refused', () => {
    expect(() => planChangeFromAction({ type: 'update_plan', itemId: 'lunch', endLocal: '2026-11-14 11:00' }, lunch, trip)).toThrow();
  });
});

describe('proposalsFromReply', () => {
  test('snapshots the plan as it was when proposed, so a later save cannot make before and after look the same', () => {
    const [proposal] = proposalsFromReply([{ type: 'update_plan', itemId: 'lunch', startLocal: '2026-11-14 13:00' }], [lunch]);
    expect(proposal).toEqual({
      action: { type: 'update_plan', itemId: 'lunch', startLocal: '2026-11-14 13:00' },
      before: { title: 'Lunch', startsAt: lunch.startsAt, endsAt: lunch.endsAt },
      status: 'pending',
    });
  });
});
