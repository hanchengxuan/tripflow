import { currenciesNeedingRates, planRedenomination, unconvertedExpenses } from '@/lib/redenominate';

const expense = (id: string, currency: string, totalMinor: number, baseCurrency?: string) => ({
  id, currency, totalMinor, baseCurrency,
});

describe('currenciesNeedingRates', () => {
  it('lists every currency except the target, in first-seen order', () => {
    const expenses = [expense('a', 'JPY', 1000), expense('b', 'CNY', 5000), expense('c', 'JPY', 200)];
    expect(currenciesNeedingRates(expenses, 'CNY')).toEqual(['JPY']);
    expect(currenciesNeedingRates(expenses, 'USD')).toEqual(['JPY', 'CNY']);
  });

  it('is case-insensitive about the target and the expenses', () => {
    expect(currenciesNeedingRates([expense('a', 'jpy', 1000)], 'JPY')).toEqual([]);
    expect(currenciesNeedingRates([expense('a', 'JPY', 1000)], 'jpy')).toEqual([]);
  });

  it('needs nothing for an empty ledger', () => {
    expect(currenciesNeedingRates([], 'CNY')).toEqual([]);
  });
});

describe('planRedenomination', () => {
  it('leaves an expense already in the target at rate 1 and the same amount', () => {
    const { lines, missingRates } = planRedenomination({
      expenses: [expense('a', 'JPY', 12000)],
      rates: {},
      target: 'JPY',
    });
    expect(missingRates).toEqual([]);
    expect(lines).toEqual([
      { expenseId: 'a', currency: 'JPY', totalMinor: 12000, baseCurrency: 'JPY', baseAmountMinor: 12000, exchangeRate: 1 },
    ]);
  });

  it('converts across differing minor-unit precision', () => {
    // JPY has no minor unit, CNY has two: ¥12,000 at 0.05 CNY per yen is ￥600.00.
    const { lines } = planRedenomination({
      expenses: [expense('a', 'JPY', 12000)],
      rates: { JPY: 0.05 },
      target: 'CNY',
    });
    expect(lines[0].baseAmountMinor).toBe(60000);

    // And back the other way: ￥600.00 at 20 JPY per yuan is ¥12,000.
    const back = planRedenomination({ expenses: [expense('a', 'CNY', 60000)], rates: { CNY: 20 }, target: 'JPY' });
    expect(back.lines[0].baseAmountMinor).toBe(12000);
  });

  it('never rewrites what was actually paid', () => {
    const { lines } = planRedenomination({
      expenses: [expense('a', 'EUR', 2599)],
      rates: { EUR: 7.8 },
      target: 'CNY',
    });
    expect(lines[0].currency).toBe('EUR');
    expect(lines[0].totalMinor).toBe(2599);
  });

  it('reports a currency with no rate instead of guessing one', () => {
    const { lines, missingRates } = planRedenomination({
      expenses: [expense('a', 'JPY', 1000), expense('b', 'EUR', 2000)],
      rates: { JPY: 0.05 },
      target: 'CNY',
    });
    expect(missingRates).toEqual(['EUR']);
    expect(lines.map(({ expenseId }) => expenseId)).toEqual(['a']);
  });

  it('treats a zero or negative rate as missing', () => {
    expect(planRedenomination({ expenses: [expense('a', 'JPY', 1)], rates: { JPY: 0 }, target: 'CNY' }).missingRates).toEqual(['JPY']);
    expect(planRedenomination({ expenses: [expense('a', 'JPY', 1)], rates: { JPY: -2 }, target: 'CNY' }).missingRates).toEqual(['JPY']);
  });

  it('lists a missing currency once however many expenses use it', () => {
    const { missingRates } = planRedenomination({
      expenses: [expense('a', 'EUR', 1), expense('b', 'EUR', 2)],
      rates: {},
      target: 'CNY',
    });
    expect(missingRates).toEqual(['EUR']);
  });
});

describe('unconvertedExpenses', () => {
  it('finds what a half-finished run left behind', () => {
    const expenses = [
      expense('a', 'JPY', 1000, 'CNY'),
      expense('b', 'JPY', 2000, 'JPY'),
      expense('c', 'EUR', 3000, 'CNY'),
    ];
    expect(unconvertedExpenses(expenses, 'JPY').map(({ id }) => id)).toEqual(['a', 'c']);
  });

  it('is empty once every expense is stated in the base', () => {
    const expenses = [expense('a', 'JPY', 1000, 'CNY'), expense('b', 'EUR', 3000, 'CNY')];
    expect(unconvertedExpenses(expenses, 'CNY')).toEqual([]);
  });

  it('treats an expense with no conversion recorded as done when it is already in the base', () => {
    expect(unconvertedExpenses([expense('a', 'CNY', 1000, undefined)], 'CNY')).toEqual([]);
    expect(unconvertedExpenses([expense('a', 'JPY', 1000, undefined)], 'CNY').map(({ id }) => id)).toEqual(['a']);
  });
});
