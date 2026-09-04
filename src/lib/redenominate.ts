import { convertMinorAmount } from '@/domain/ledger';
import type { Expense } from '@/domain/models';

/**
 * Restating a ledger in a different currency.
 *
 * Paying in several currencies on one trip is ordinary, and every expense
 * already keeps what was actually paid — its own `currency` and `totalMinor`.
 * What the ledger's base currency decides is only the unit those are summed
 * and settled in: each expense also carries a `baseAmountMinor` converted at
 * the rate of the day.
 *
 * Changing the base therefore means restating every one of those conversions.
 * Nothing here is lossy: an expense's original currency and amount are never
 * touched, so a base can be restated again, or restated back.
 *
 * The work is planned here, as data, so it can be checked without a network
 * and so a half-finished run can be detected and resumed — an expense whose
 * `baseCurrency` no longer matches the trip's is one that still needs doing.
 */

export interface RedenominationLine {
  expenseId: string;
  /** What was actually paid — never rewritten. */
  currency: string;
  totalMinor: number;
  /** The same money, restated in the new base. */
  baseCurrency: string;
  baseAmountMinor: number;
  exchangeRate: number;
}

export interface RedenominationPlan {
  lines: RedenominationLine[];
  /** Currencies with no usable rate; the plan cannot run until they have one. */
  missingRates: string[];
}

/** The currencies a plan needs a rate for, in first-seen order. */
export function currenciesNeedingRates(expenses: readonly Pick<Expense, 'currency'>[], target: string) {
  const wanted = target.toUpperCase();
  const seen: string[] = [];
  for (const { currency } of expenses) {
    const code = currency.toUpperCase();
    if (code === wanted || seen.includes(code)) continue;
    seen.push(code);
  }
  return seen;
}

/**
 * What each expense becomes in the new base.
 *
 * `rates` maps an expense's own currency to how much of the new base one unit
 * of it is worth. The new base itself is always 1 and never has to be given.
 */
export function planRedenomination({
  expenses,
  rates,
  target,
}: {
  expenses: readonly Pick<Expense, 'id' | 'currency' | 'totalMinor'>[];
  rates: Readonly<Record<string, number>>;
  target: string;
}): RedenominationPlan {
  const base = target.toUpperCase();
  const lines: RedenominationLine[] = [];
  const missingRates: string[] = [];

  for (const expense of expenses) {
    const currency = expense.currency.toUpperCase();
    const rate = currency === base ? 1 : rates[currency];
    if (!Number.isFinite(rate) || (rate ?? 0) <= 0) {
      if (!missingRates.includes(currency)) missingRates.push(currency);
      continue;
    }
    lines.push({
      expenseId: expense.id,
      currency: expense.currency,
      totalMinor: expense.totalMinor,
      baseCurrency: base,
      baseAmountMinor: convertMinorAmount(expense.totalMinor, expense.currency, base, rate as number),
      exchangeRate: rate as number,
    });
  }

  return { lines, missingRates };
}

/**
 * Expenses still denominated against some other base — what a previous run did
 * not finish. Each conversion is independent and re-applying one is harmless,
 * so a run that stops halfway is resumed rather than rolled back.
 */
export function unconvertedExpenses<T extends Pick<Expense, 'baseCurrency' | 'currency'>>(
  expenses: readonly T[],
  base: string,
): T[] {
  const wanted = base.toUpperCase();
  return expenses.filter((expense) => {
    // An expense recorded in the base itself needs no conversion recorded.
    if (!expense.baseCurrency) return expense.currency.toUpperCase() !== wanted;
    return expense.baseCurrency.toUpperCase() !== wanted;
  });
}
