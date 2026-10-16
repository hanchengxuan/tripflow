import type { Expense } from '@/domain/models';
import { groupExpensesByDay } from '@/features/ledger/group-expenses-by-day';

function expense(id: string, occurredAt: string): Expense {
  return {
    id,
    tripId: 'trip',
    title: id,
    currency: 'JPY',
    totalMinor: 1000,
    payers: [],
    shares: [],
    occurredAt,
    source: 'manual',
  } as Expense;
}

describe('groupExpensesByDay', () => {
  it('returns no days for no expenses', () => {
    expect(groupExpensesByDay([], 'Asia/Tokyo')).toEqual([]);
  });

  it('groups by the trip-local date and orders newest first', () => {
    const days = groupExpensesByDay([
      expense('lunch', '2026-10-01T03:30:00Z'),
      expense('late-ramen', '2026-10-01T15:10:00Z'),
      expense('breakfast', '2026-10-01T00:05:45Z'),
    ], 'Asia/Tokyo');

    expect(days.map(({ date, expenses }) => [date, expenses.map(({ id, localTime }) => `${id}@${localTime}`)])).toEqual([
      // 15:10Z is 00:10 the next morning in Tokyo.
      ['2026-10-02', ['late-ramen@00:10']],
      ['2026-10-01', ['lunch@12:30', 'breakfast@09:05']],
    ]);
  });
});
