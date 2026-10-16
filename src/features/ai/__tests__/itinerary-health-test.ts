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
      locale: 'zh-CN',
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

  it('treats a multi-night stay as a backdrop, not a clash with the plans inside it', async () => {
    const stay = item({ id: 'stay', kind: 'lodging', title: 'Hotel', locationLabel: 'Hotel', startsAt: '2026-08-14T06:00:00.000Z', endsAt: '2026-08-17T02:00:00.000Z' });
    const museum = item({ id: 'museum', locationLabel: 'Museum', startsAt: '2026-08-14T05:00:00.000Z', endsAt: '2026-08-14T08:00:00.000Z' });
    const dinner = item({ id: 'dinner', kind: 'food', locationLabel: 'Izakaya', startsAt: '2026-08-14T07:30:00.000Z', endsAt: '2026-08-14T09:00:00.000Z' });
    const report = await analyzeItineraryHealth({ locale: 'en', items: [stay, museum, dinner] });

    expect(report.issues.filter(({ type }) => type === 'CONFLICT').map(({ itemIds }) => itemIds)).toEqual([['museum', 'dinner']]);
  });

  it('still flags two stays that overlap', async () => {
    const first = item({ id: 'first', kind: 'lodging', locationLabel: 'A', startsAt: '2026-08-14T06:00:00.000Z', endsAt: '2026-08-17T02:00:00.000Z' });
    const second = item({ id: 'second', kind: 'lodging', locationLabel: 'B', startsAt: '2026-08-16T06:00:00.000Z', endsAt: '2026-08-18T02:00:00.000Z' });
    const report = await analyzeItineraryHealth({ locale: 'en', items: [first, second] });

    expect(report.issues).toEqual([expect.objectContaining({ type: 'CONFLICT', itemIds: ['first', 'second'] })]);
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


describe('localized local reports', () => {
  const plans = [
    item({ id: 'a', title: 'Breakfast', locationLabel: 'Cafe' }),
    item({ id: 'b', title: 'Museum', locationLabel: 'Museum', startsAt: '2026-08-14T10:10:00.000Z', endsAt: '2026-08-14T11:00:00.000Z' }),
    item({ id: 'c', title: 'Lunch', locationLabel: 'Cafe', startsAt: '2026-08-14T10:30:00.000Z', endsAt: '2026-08-14T11:30:00.000Z' }),
    item({ id: 'd', title: '', startsAt: '2026-08-14T12:00:00.000Z', endsAt: '2026-08-14T13:00:00.000Z' }),
    item({ id: 'e', title: 'Walk', locationLabel: 'Park', startsAt: '2026-08-14T14:00:00.000Z', endsAt: '2026-08-14T15:00:00.000Z' }),
  ];

  it('renders every issue type and summary in English', async () => {
    const report = await analyzeItineraryHealth({ items: plans, locale: 'en' });
    expect(report.issues.map(({ type }) => type).sort()).toEqual(['BUFFER', 'CONFLICT', 'DENSE_DAY', 'MISSING_LOCATION']);
    expect(JSON.stringify(report)).not.toMatch(/[㐀-鿿]/u);
    expect(report.summary).toBe('4 itinerary issues need attention.');
    expect(report.issues.find(({ type }) => type === 'BUFFER')?.reason).toContain('fewer than 30 minutes');
    expect(report.issues.find(({ type }) => type === 'CONFLICT')?.reason).toBe('“Museum” and “Lunch” overlap.');
  });

  it('switches the same plans back to Chinese without changing findings', async () => {
    const en = await analyzeItineraryHealth({ items: plans, locale: 'en' });
    const zh = await analyzeItineraryHealth({ items: plans, locale: 'zh-CN' });
    expect(zh.issues.map(({ id }) => id)).toEqual(en.issues.map(({ id }) => id));
    expect(zh.summary).toBe('发现 4 个需要处理的行程问题。');
    expect(zh.issues.find(({ type }) => type === 'BUFFER')?.title).toBe('衔接时间较短');
  });

  it('uses singular and empty English summaries while preserving user titles', async () => {
    const report = await analyzeItineraryHealth({ items: [item({ title: '用户原名' })], locale: 'en' });
    expect(report.summary).toBe('1 itinerary issue needs attention.');
    expect(report.issues[0].title).toBe('用户原名');
    expect(report.issues[0].reason).toBe('This plan has no location. Add one before you leave.');
    expect((await analyzeItineraryHealth({ items: [], locale: 'en' })).summary).toBe('No itinerary issues need attention right now.');
  });

  it('localizes malformed-field fallbacks in Chinese', () => {
    const report = validateItineraryHealthReport({ issues: [{ type: 'BUFFER', severity: 'warning', itemIds: ['a'] }] }, ['a'], 'zh-CN');
    expect(report.summary).toBe('行程目前没有需要处理的问题。');
    expect(report.issues[0]).toMatchObject({ title: '请检查这项安排', reason: '这项安排可能需要检查。' });
  });
});
