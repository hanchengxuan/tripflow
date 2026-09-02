import { destinationStatus } from '@/lib/destination-status';

const now = Date.parse('2026-03-14T10:00:00Z');

describe('destinationStatus', () => {
  it('is current while now falls inside a span', () => {
    expect(destinationStatus([{ startsAt: '2026-03-14T09:00:00Z', endsAt: '2026-03-14T11:00:00Z' }], now)).toBe('current');
  });

  it('treats a span with no end as a single instant', () => {
    expect(destinationStatus([{ startsAt: '2026-03-14T10:00:00Z' }], now)).toBe('current');
    expect(destinationStatus([{ startsAt: '2026-03-14T09:59:59Z' }], now)).toBe('visited');
  });

  it('is planned when every span is still ahead', () => {
    expect(destinationStatus([{ startsAt: '2026-03-15T09:00:00Z', endsAt: '2026-03-15T11:00:00Z' }], now)).toBe('planned');
  });

  it('is visited when every span is behind', () => {
    expect(destinationStatus([{ startsAt: '2026-03-12T09:00:00Z', endsAt: '2026-03-12T11:00:00Z' }], now)).toBe('visited');
  });

  it('prefers current over planned when a place holds both', () => {
    expect(destinationStatus([
      { startsAt: '2026-03-14T09:00:00Z', endsAt: '2026-03-14T11:00:00Z' },
      { startsAt: '2026-03-16T09:00:00Z', endsAt: '2026-03-16T11:00:00Z' },
    ], now)).toBe('current');
  });

  it('prefers planned over visited when a place holds both', () => {
    expect(destinationStatus([
      { startsAt: '2026-03-12T09:00:00Z', endsAt: '2026-03-12T11:00:00Z' },
      { startsAt: '2026-03-16T09:00:00Z', endsAt: '2026-03-16T11:00:00Z' },
    ], now)).toBe('planned');
  });

  it('reports a place with no plans as visited rather than throwing', () => {
    expect(destinationStatus([], now)).toBe('visited');
  });
});
