import { calculateBalancesByCurrency, parseAmountToMinor } from '@/domain/ledger';
import type { Expense } from '@/domain/models';

describe('ledger helpers', () => {
  it('parses two-decimal and zero-decimal currencies without floating-point math', () => {
    expect(parseAmountToMinor('860.25', 'HKD')).toBe(86025);
    expect(parseAmountToMinor('1200', 'JPY')).toBe(1200);
    expect(() => parseAmountToMinor('12.50', 'JPY')).toThrow('whole-number');
  });

  it('calculates payer-minus-share balances per original currency', () => {
    const expenses: Expense[] = [{
      id: 'expense-1',
      tripId: 'trip-1',
      title: 'Dinner',
      currency: 'HKD',
      totalMinor: 900,
      occurredAt: '2026-12-01T12:00:00Z',
      source: 'manual',
      payers: [{ userId: 'a', amountMinor: 900 }],
      shares: [
        { userId: 'a', amountMinor: 300 },
        { userId: 'b', amountMinor: 300 },
        { userId: 'c', amountMinor: 300 },
      ],
    }];

    expect(calculateBalancesByCurrency(expenses, ['a', 'b', 'c'])).toEqual([{
      currency: 'HKD',
      balances: [
        { participantId: 'a', netMinor: 600 },
        { participantId: 'b', netMinor: -300 },
        { participantId: 'c', netMinor: -300 },
      ],
    }]);
  });
});
