import { formatZonedDateTimeRange, isoToZonedDateTime, shiftPlanTimes, stayNightsInZone, zonedDateTimeToIso } from '@/lib/trip-time';

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

describe('shiftPlanTimes', () => {
  const evening = { date: '2026-10-21', startTime: '18:30', endDate: '2026-10-21', endTime: '20:00' };

  test('moving a plan shifts its start and end together', () => {
    expect(shiftPlanTimes(evening, { kind: 'move', minutes: 30 })).toEqual({ date: '2026-10-21', startTime: '19:00', endDate: '2026-10-21', endTime: '20:30' });
    expect(shiftPlanTimes(evening, { kind: 'move', minutes: -30 })).toEqual({ date: '2026-10-21', startTime: '18:00', endDate: '2026-10-21', endTime: '19:30' });
  });

  test('moving across midnight and month ends rolls the dates over', () => {
    const late = { date: '2026-10-31', startTime: '23:30', endDate: '2026-10-31', endTime: '23:50' };
    expect(shiftPlanTimes(late, { kind: 'move', minutes: 60 })).toEqual({ date: '2026-11-01', startTime: '00:30', endDate: '2026-11-01', endTime: '00:50' });
  });

  test('moving to the next day keeps the clock times', () => {
    expect(shiftPlanTimes(evening, { kind: 'move', minutes: 24 * 60 })).toEqual({ date: '2026-10-22', startTime: '18:30', endDate: '2026-10-22', endTime: '20:00' });
  });

  test('extending a plan changes only its end', () => {
    expect(shiftPlanTimes(evening, { kind: 'extend', minutes: 30 })).toEqual({ date: '2026-10-21', startTime: '18:30', endDate: '2026-10-21', endTime: '20:30' });
  });
});
