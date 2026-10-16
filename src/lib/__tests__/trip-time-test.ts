import { formatZonedDateTimeRange, isoToZonedDateTime, planCountdown, shiftPlanTimes, stayNightsInZone, tripProgress, zonedDateTimeToIso } from '@/lib/trip-time';

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

describe('planCountdown', () => {
  const now = Date.parse('2026-10-20T07:00:00Z');
  it('rounds to minutes, hours, then days', () => {
    expect(planCountdown('2026-10-20T07:25:00Z', undefined, now)).toEqual({ status: 'upcoming', unit: 'minute', value: 25 });
    expect(planCountdown('2026-10-20T09:30:00Z', undefined, now)).toEqual({ status: 'upcoming', unit: 'hour', value: 3 });
    expect(planCountdown('2026-10-23T07:00:00Z', undefined, now)).toEqual({ status: 'upcoming', unit: 'day', value: 3 });
  });
  it('says a plan is happening until it ends, then past', () => {
    expect(planCountdown('2026-10-20T06:00:00Z', '2026-10-20T08:00:00Z', now)).toEqual({ status: 'now' });
    expect(planCountdown('2026-10-20T05:00:00Z', '2026-10-20T06:00:00Z', now)).toEqual({ status: 'past' });
  });
});

describe('tripProgress', () => {
  it('counts down to the trip, numbers its days, and marks it ended', () => {
    expect(tripProgress('2026-10-20', '2026-10-25', '2026-10-15')).toEqual({ status: 'upcoming', daysUntil: 5, totalDays: 6 });
    expect(tripProgress('2026-10-20', '2026-10-25', '2026-10-20')).toEqual({ status: 'active', day: 1, totalDays: 6 });
    expect(tripProgress('2026-10-20', '2026-10-25', '2026-10-25')).toEqual({ status: 'active', day: 6, totalDays: 6 });
    expect(tripProgress('2026-10-20', '2026-10-25', '2026-10-26')).toEqual({ status: 'ended', totalDays: 6 });
  });
});
