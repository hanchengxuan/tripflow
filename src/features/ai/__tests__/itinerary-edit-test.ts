import type { ItineraryItem } from '@/domain/models';
import { mergeItineraryEdit, validateItineraryEditProposal, validateMergedItineraryEdit } from '@/features/ai/itinerary-edit';

function item(overrides: Partial<ItineraryItem> = {}): ItineraryItem {
  return {
    id: 'item-1',
    tripId: 'trip-1',
    kind: 'food',
    title: '晚餐',
    startsAt: '2026-08-14T10:00:00.000Z',
    endsAt: '2026-08-14T11:00:00.000Z',
    routeTravelMode: 'DRIVE',
    ...overrides,
  };
}

describe('itinerary edit proposals', () => {
  it('accepts one known, bounded change and rejects unsupported fields', () => {
    expect(validateItineraryEditProposal({
      summary: '把晚餐延后',
      confidence: 1.2,
      changes: [{ itemId: 'item-1', startsAt: '2026-08-14T12:00:00.000Z', reason: '博物馆结束后再吃饭' }],
      warnings: [],
    }, ['item-1']).confidence).toBe(1);

    expect(() => validateItineraryEditProposal({
      changes: [{ itemId: 'item-1', locationLabel: '新地点', reason: '换地方' }],
    }, ['item-1'])).toThrow('暂不支持');
  });

  it('rejects unknown or multiple changes', () => {
    expect(() => validateItineraryEditProposal({
      changes: [{ itemId: 'missing', title: '晚餐', reason: '修改' }],
    }, ['item-1'])).toThrow('不存在');
    expect(() => validateItineraryEditProposal({
      changes: [
        { itemId: 'item-1', title: '晚餐', reason: '修改' },
        { itemId: 'item-2', title: '散步', reason: '修改' },
      ],
    }, ['item-1', 'item-2'])).toThrow('一次只能');
  });

  it('keeps the original duration when only the start moves', () => {
    const changed = mergeItineraryEdit(item(), {
      itemId: 'item-1',
      startsAt: '2026-08-14T12:30:00.000Z',
      reason: '改到午餐后',
    });
    expect(changed.startsAt).toBe('2026-08-14T12:30:00.000Z');
    expect(changed.endsAt).toBe('2026-08-14T13:30:00.000Z');
  });

  it('blocks an overlap and a change outside the trip dates', () => {
    const candidate = mergeItineraryEdit(item(), {
      itemId: 'item-1',
      startsAt: '2026-08-14T10:30:00.000Z',
      reason: '稍后开始',
    });
    const overlap = validateMergedItineraryEdit({
      candidate,
      items: [candidate, item({ id: 'item-2', title: '展览', startsAt: '2026-08-14T11:00:00.000Z', endsAt: '2026-08-14T12:00:00.000Z' })],
      trip: { startsOn: '2026-08-14', endsOn: '2026-08-15' },
      timeZone: 'UTC',
    });
    expect(overlap.errors[0]?.code).toBe('OVERLAP');

    const outside = validateMergedItineraryEdit({
      candidate: item({ startsAt: '2026-08-16T10:00:00.000Z', endsAt: '2026-08-16T11:00:00.000Z' }),
      items: [],
      trip: { startsOn: '2026-08-14', endsOn: '2026-08-15' },
      timeZone: 'UTC',
    });
    expect(outside.errors[0]?.code).toBe('OUTSIDE_TRIP');
  });
});
