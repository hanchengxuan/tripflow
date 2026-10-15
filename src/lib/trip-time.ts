function dateTimeParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

export function zonedDateTimeToIso(date: string, time: string, timeZone: string) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite)) throw new Error('Invalid local date or time');
  const target = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = target;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = dateTimeParts(new Date(guess), timeZone);
    const observed = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second),
    );
    guess += target - observed;
  }
  return new Date(guess).toISOString();
}

export function isoToZonedDateTime(value: string, timeZone: string) {
  const parts = dateTimeParts(new Date(value), timeZone);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

export function formatZonedDateTimeRange(
  startsAt: string,
  endsAt: string | undefined,
  locale: string,
  timeZone: string,
) {
  const dateOptions: Intl.DateTimeFormatOptions = { timeZone, month: 'short', day: 'numeric', weekday: 'short' };
  const timeOptions: Intl.DateTimeFormatOptions = { timeZone, hour: '2-digit', minute: '2-digit', hour12: false };
  const start = new Date(startsAt);
  const date = start.toLocaleDateString(locale, dateOptions);
  const startTime = start.toLocaleTimeString(locale, timeOptions);
  if (!endsAt) return `${date} · ${startTime}`;
  const end = new Date(endsAt);
  const endTime = end.toLocaleTimeString(locale, timeOptions);
  const startDay = new Intl.DateTimeFormat('en-CA', { timeZone, dateStyle: 'short' }).format(start);
  const endDay = new Intl.DateTimeFormat('en-CA', { timeZone, dateStyle: 'short' }).format(end);
  if (startDay === endDay) return `${date} · ${startTime}–${endTime}`;
  return `${date} ${startTime} — ${end.toLocaleDateString(locale, dateOptions)} ${endTime}`;
}

export function stayNightsInZone(startsAt: string, endsAt: string | undefined, timeZone: string) {
  if (!endsAt) return 1;
  const localDate = (value: string) => {
    const parts = dateTimeParts(new Date(value), timeZone);
    return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  };
  return Math.max(1, Math.round((localDate(endsAt) - localDate(startsAt)) / 86_400_000));
}

export interface PlanTimes {
  date: string;
  startTime: string;
  endDate: string;
  endTime: string;
}

export interface PlanTimeShift {
  kind: 'move' | 'extend';
  minutes: number;
}

function addWallClockMinutes(date: string, time: string, minutes: number) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day, hour, minute + minutes)).toISOString();
  return { date: shifted.slice(0, 10), time: shifted.slice(11, 16) };
}

/** Shifts wall-clock form values, so "an hour later" means the same thing in any time zone. */
export function shiftPlanTimes(times: PlanTimes, shift: PlanTimeShift): PlanTimes {
  const end = addWallClockMinutes(times.endDate, times.endTime, shift.minutes);
  if (shift.kind === 'extend') return { ...times, endDate: end.date, endTime: end.time };
  const start = addWallClockMinutes(times.date, times.startTime, shift.minutes);
  return { date: start.date, startTime: start.time, endDate: end.date, endTime: end.time };
}
