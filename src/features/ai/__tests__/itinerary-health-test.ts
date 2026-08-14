import type { ItineraryItem } from '@/domain/models';
import { analyzeItineraryHealth, hasItineraryHealthIssues, validateItineraryHealthReport } from '@/features/ai/itinerary-health';

function item(overrides: Partial<ItineraryItem>): ItineraryItem {
  return {
    id: overrides.id ?? 'item-a',
    tripId: 'trip-a',
    kind: 'activity',
    title: '安排',
    startsAt: '2026-08-14T09:00:00.000Z',
    endsAt: '2026-08-14T10:00:00.000Z',
    routeTravelMode: 'WALK',
    ...overrides,
  };
}

describe('itinerary health checks', () => {
  it('only exposes the issue surface when the report has issues', () => {
    expect(hasItineraryHealthIssues(undefined)).toBe(false);
    expect(hasItineraryHealthIssues({ summary: 'ok', issues: [] })).toBe(false);
    expect(hasItineraryHealthIssues({
      summary: 'needs review',
      issues: [{
        id: 'conflict',
        type: 'CONFLICT',
        severity: 'critical',
        itemIds: ['item-a', 'item-b'],
        title: '时间安排重叠',
        reason: '两个安排发生重叠。',
        confidence: 1,
      }],
    })).toBe(true);
  });

  it('finds overlap and a missing location locally', async () => {
    const report = await analyzeItineraryHealth({
      items: [
        item({ id: 'item-a', title: '早餐', locationLabel: '餐厅' }),
        item({ id: 'item-b', title: '博物馆', startsAt: '2026-08-14T09:45:00.000Z', endsAt: '2026-08-14T11:00:00.000Z' }),
      ],
    });

    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'CONFLICT', itemIds: ['item-a', 'item-b'] }),
      expect.objectContaining({ type: 'MISSING_LOCATION', itemIds: ['item-b'] }),
    ]));
    expect(report.issues.some(({ type }) => type === 'BUFFER')).toBe(false);
  });

  it('limits a report to known item IDs and bounded fields', () => {
    const report = validateItineraryHealthReport({
      summary: ' '.repeat(400),
      issues: [{
        id: 'known',
        type: 'BUFFER',
        severity: 'warning',
        itemIds: ['known', 'unknown', 'known'],
        title: 'title',
        reason: 'reason',
        confidence: 4,
      }],
    }, ['known']);

    expect(report.issues[0]).toMatchObject({ itemIds: ['known'], confidence: 1 });
    expect(report.summary).toBe('No obvious itinerary issues found.');
  });

  it('drops malformed or unscoped model issues instead of displaying them', () => {
    const report = validateItineraryHealthReport({
      summary: 'ok',
      issues: [
        { type: 'UNKNOWN', severity: 'critical', itemIds: ['item-a'] },
        { type: 'CONFLICT', severity: 'critical', itemIds: ['not-in-trip'] },
      ],
    }, ['item-a']);

    expect(report).toEqual({ summary: 'ok', issues: [] });
  });
});
