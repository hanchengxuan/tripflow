import type { BookingPreview } from './booking-preview';
import { isoToZonedDateTime, zonedDateTimeToIso } from '@/lib/trip-time';
import { InputError } from '@/domain/input-error';
import type { Trip } from '@/domain/models';

export function bookingLocalToIso(local: string, timeZone: string) {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(local) || !timeZone) throw new InputError('请补全当地日期、时间和时区。', 'Complete the local date, time, and time zone.');
  try { new Intl.DateTimeFormat('en', { timeZone }).format(); }
  catch { throw new InputError('请选择有效时区。', 'Choose a valid time zone.'); }
  const [date, time] = local.split(' ');
  const iso = zonedDateTimeToIso(date, time, timeZone);
  const roundTrip = (value: string) => {
    const parts = isoToZonedDateTime(value, timeZone);
    return `${parts.date} ${parts.time}`;
  };
  if (roundTrip(iso) !== local) throw new InputError('这个当地日期或时间不存在，请核对原订单。', 'This local date or time does not exist. Check the original booking.');
  for (const offset of [-120, -60, -30, 30, 60, 120]) {
    if (roundTrip(new Date(new Date(iso).getTime() + offset * 60_000).toISOString()) === local) throw new InputError('这个时间因夏令时有歧义，请核对并选择无歧义的时间。', 'This time is ambiguous because of daylight saving. Confirm a different time.');
  }
  return iso;
}

export function bookingToPlan(draft: BookingPreview, trip: Trip) {
  if (!draft.title.trim() || draft.title.trim().length > 180) throw new InputError('安排名称：请填写 1 至 180 个字符。', 'Plan title: enter 1 to 180 characters.');
  if (!draft.location.trim() || draft.location.trim().length > 500) throw new InputError('地点：请填写 1 至 500 个字符。', 'Place: enter 1 to 500 characters.');
  const localTime = (local: string, zone: string, zh: string, en: string) => {
    try { return bookingLocalToIso(local, zone); }
    catch (caught) {
      if (caught instanceof InputError) throw new InputError(`${zh}：${caught.message}`, `${en}: ${caught.english}`);
      throw new InputError(`${zh}：请核对日期、时间和时区。`, `${en}: check the date, time, and time zone.`);
    }
  };
  const hotel = draft.kind === 'hotel';
  const startsAt = localTime(draft.startLocal, draft.startTimeZone, hotel ? '入住时间' : '出发时间', hotel ? 'Check-in time' : 'Departure time');
  const endsAt = localTime(draft.endLocal, draft.endTimeZone, hotel ? '退房时间' : '到达时间', hotel ? 'Check-out time' : 'Arrival time');
  if (endsAt <= startsAt) throw new InputError('结束时间必须晚于开始时间，请核对当地时间和时区。', 'The end must be after the start. Check local times and zones.');
  const startDate = isoToZonedDateTime(startsAt, trip.defaultTimeZone).date;
  const endDate = isoToZonedDateTime(endsAt, trip.defaultTimeZone).date;
  if (startDate < trip.startsOn || endDate > trip.endsOn) throw new InputError(`订单超出行程日期 ${trip.startsOn} 至 ${trip.endsOn}，请修改订单时间或先调整行程日期。`, `Booking is outside ${trip.startsOn} to ${trip.endsOn}. Correct its times or update the trip dates first.`);
  return {
    title: draft.title.trim(),
    kind: draft.kind === 'hotel' ? 'lodging' as const : 'transport' as const,
    startsAt,
    endsAt,
    locationLabel: draft.location.trim(),
    destination: draft.destination ? { ...draft.destination } : undefined,
  };
}
