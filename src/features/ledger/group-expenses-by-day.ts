import type { Expense } from '@/domain/models';
import { isoToZonedDateTime } from '@/lib/trip-time';

export interface ExpenseDay {
  /** Local calendar date in the trip time zone, `YYYY-MM-DD`. */
  date: string;
  expenses: (Expense & { localTime: string })[];
}

/** Newest day first, newest expense first within a day, in the trip's local time. */
export function groupExpensesByDay(expenses: Expense[], timeZone: string): ExpenseDay[] {
  const days = new Map<string, ExpenseDay['expenses']>();
  const sorted = [...expenses].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
  for (const expense of sorted) {
    const { date, time } = isoToZonedDateTime(expense.occurredAt, timeZone);
    const day = days.get(date) ?? [];
    day.push({ ...expense, localTime: time });
    days.set(date, day);
  }
  return [...days.entries()].map(([date, dayExpenses]) => ({ date, expenses: dayExpenses }));
}
