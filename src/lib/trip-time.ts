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
