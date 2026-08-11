import { formatZonedDateTimeRange, isoToZonedDateTime, stayNightsInZone, zonedDateTimeToIso } from '@/lib/trip-time';

describe('trip time helpers', () => {
  it('stores wall-clock hotel time in the trip time zone', () => {
    expect(zonedDateTimeToIso('2026-08-10', '15:00', 'Asia/Tokyo')).toBe('2026-08-10T06:00:00.000Z');
    expect(isoToZonedDateTime('2026-08-10T06:00:00.000Z', 'Asia/Tokyo')).toEqual({ date: '2026-08-10', time: '15:00' });
  });

  it('keeps lodging dates and nights stable in the trip time zone', () => {
    const start = zonedDateTimeToIso('2026-08-10', '15:00', 'Asia/Tokyo');
    const end = zonedDateTimeToIso('2026-08-15', '11:00', 'Asia/Tokyo');
    expect(stayNightsInZone(start, end, 'Asia/Tokyo')).toBe(5);
    expect(formatZonedDateTimeRange(start, end, 'en-US', 'Asia/Tokyo')).toContain('Aug 10');
    expect(formatZonedDateTimeRange(start, end, 'en-US', 'Asia/Tokyo')).toContain('Aug 15');
  });
});
