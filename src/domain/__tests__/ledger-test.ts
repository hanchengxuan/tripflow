import { calculateBalancesByCurrency, calculateOutstandingBalancesByCurrency, parseAmountToMinor } from '@/domain/ledger';
import type { Expense, Settlement } from '@/domain/models';

describe('ledger helpers', () => {
  it('parses two-decimal and zero-decimal currencies without floating-point math', () => {
    expect(parseAmountToMinor('860.25', 'HKD')).toBe(86025);
    expect(parseAmountToMinor('1200', 'JPY')).toBe(1200);
    expect(() => parseAmountToMinor('12.50', 'JPY')).toThrow('整数金额');
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

  it('reduces outstanding balances when the sender marks a transfer as sent', () => {
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
    const settlements: Settlement[] = [{
      id: 'settlement-1',
      tripId: 'trip-1',
      fromUserId: 'b',
      toUserId: 'a',
      currency: 'HKD',
      amountMinor: 300,
      settledAt: '2026-12-02T12:00:00Z',
      recordedBy: 'b',
    }];

    expect(calculateOutstandingBalancesByCurrency(expenses, settlements, ['a', 'b', 'c'])).toEqual([{
      currency: 'HKD',
      balances: [
        { participantId: 'a', netMinor: 300 },
        { participantId: 'b', netMinor: 0 },
        { participantId: 'c', netMinor: -300 },
      ],
    }]);
  });
});
