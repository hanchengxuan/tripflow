import type { ItineraryItem } from '@/domain/models';
import { isoToZonedDateTime } from '@/lib/trip-time';

interface BriefingEntry {
  time: string;
  title: string;
}

export interface DayBriefing {
  /** YYYY-MM-DD in the trip time zone. */
  date: string;
  relative: 'today' | 'tomorrow' | 'later';
  planCount: number;
  /** When the day's last plan ends, so travellers know how long the day runs. */
  last?: BriefingEntry & { date?: string };
  checkOuts: BriefingEntry[];
  checkIns: BriefingEntry[];
}

type Event = { kind: 'plan' | 'checkIn' | 'checkOut'; at: string; title: string; endsAt?: string };

/** Summarizes the next trip day that still has something ahead: today if anything remains, otherwise the next day with a plan, check-in or check-out. */
export function buildDayBriefing(items: ItineraryItem[], now: Date, timeZone: string): DayBriefing | undefined {
  const events: Event[] = items.flatMap((item): Event[] => item.kind === 'lodging'
    ? [{ kind: 'checkIn', at: item.startsAt, title: item.title }, ...(item.endsAt ? [{ kind: 'checkOut' as const, at: item.endsAt, title: item.title }] : [])]
    : [{ kind: 'plan', at: item.startsAt, title: item.title, endsAt: item.endsAt }])
    .filter((event) => new Date(event.at).getTime() >= now.getTime())
    .sort((left, right) => new Date(left.at).getTime() - new Date(right.at).getTime());
  if (events.length === 0) return undefined;

  const local = (value: string) => isoToZonedDateTime(value, timeZone);
  const date = local(events[0].at).date;
  const onDay = events.filter((event) => local(event.at).date === date);
  const entries = (kind: Event['kind']) => onDay.filter((event) => event.kind === kind).map((event) => ({ time: local(event.at).time, title: event.title }));
  const plans = onDay.filter((event) => event.kind === 'plan');
  const last = plans.reduce<Event | undefined>((latest, event) => {
    const end = event.endsAt ?? event.at;
    return !latest || new Date(end).getTime() > new Date(latest.endsAt ?? latest.at).getTime() ? event : latest;
  }, undefined);
  const lastEnd = last ? local(last.endsAt ?? last.at) : undefined;
  const today = local(now.toISOString()).date;
  const nextDate = new Date(`${today}T12:00:00Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  const tomorrow = nextDate.toISOString().slice(0, 10);

  return {
    date,
    relative: date === today ? 'today' : date === tomorrow ? 'tomorrow' : 'later',
    planCount: plans.length,
    ...(last && lastEnd ? { last: { time: lastEnd.time, title: last.title, ...(lastEnd.date !== date ? { date: lastEnd.date } : {}) } } : {}),
    checkOuts: entries('checkOut'),
    checkIns: entries('checkIn'),
  };
}
