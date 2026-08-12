import type { Expense, Settlement } from '@/domain/models';
import type { Balance } from '@/domain/money';

const zeroDecimalCurrencies = new Set(['JPY', 'KRW']);

export function currencyMinorDigits(currency: string): number {
  return zeroDecimalCurrencies.has(currency.toUpperCase()) ? 0 : 2;
}

export function parseAmountToMinor(value: string, currency: string): number {
  const normalized = value.trim();
  const digits = currencyMinorDigits(currency);
  const pattern = digits === 0 ? /^\d+$/ : /^\d+(?:\.\d{1,2})?$/;
  if (!pattern.test(normalized)) {
    throw new Error(digits === 0 ? '该币种请输入整数金额。' : '请输入最多保留两位小数的金额。');
  }

  const [whole, fraction = ''] = normalized.split('.');
  const scale = 10 ** digits;
  const amount = Number(whole) * scale + Number(fraction.padEnd(digits, '0') || 0);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('请输入有效的正数金额。');
  return amount;
}

/** Parse a positive source-to-base exchange rate (base units per source unit). */
export function parseExchangeRate(value: string): number {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,12})?$/.test(normalized)) throw new Error('请输入有效的汇率。');
  const rate = Number(normalized);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('请输入大于 0 的汇率。');
  return rate;
}

/** Convert a minor-unit amount using an explicit, auditable exchange rate. */
export function convertMinorAmount(amountMinor: number, sourceCurrency: string, baseCurrency: string, rate: number): number {
  if (sourceCurrency.toUpperCase() === baseCurrency.toUpperCase()) return amountMinor;
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('Exchange rate must be greater than zero');
  const sourceMajor = amountMinor / 10 ** currencyMinorDigits(sourceCurrency);
  return Math.round(sourceMajor * rate * 10 ** currencyMinorDigits(baseCurrency));
}

export function formatMinorAmount(amountMinor: number, currency: string): string {
  const normalizedCurrency = currency.toUpperCase();
  const digits = currencyMinorDigits(normalizedCurrency);
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: normalizedCurrency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amountMinor / 10 ** digits);
}

export function calculateBalancesByCurrency(expenses: Expense[], participantIds: string[]) {
  const currencies = new Map<string, Map<string, number>>();
  for (const expense of expenses) {
    const balances = currencies.get(expense.currency) ?? new Map(participantIds.map((id) => [id, 0]));
    for (const payer of expense.payers) {
      balances.set(payer.userId, (balances.get(payer.userId) ?? 0) + payer.amountMinor);
    }
    for (const share of expense.shares) {
      balances.set(share.userId, (balances.get(share.userId) ?? 0) - share.amountMinor);
    }
    currencies.set(expense.currency, balances);
  }

  return [...currencies.entries()].map(([currency, participantBalances]) => ({
    currency,
    balances: [...participantBalances.entries()].map<Balance>(([participantId, netMinor]) => ({
      participantId,
      netMinor,
    })),
  }));
}

export function calculateOutstandingBalancesByCurrency(
  expenses: Expense[],
  settlements: Settlement[],
  participantIds: string[],
) {
  const currencies = new Map(
    calculateBalancesByCurrency(expenses, participantIds).map(({ currency, balances }) => [
      currency,
      new Map(balances.map(({ participantId, netMinor }) => [participantId, netMinor])),
    ]),
  );

  for (const settlement of settlements) {
    const balances = currencies.get(settlement.currency) ?? new Map(participantIds.map((id) => [id, 0]));
    balances.set(settlement.fromUserId, (balances.get(settlement.fromUserId) ?? 0) + settlement.amountMinor);
    balances.set(settlement.toUserId, (balances.get(settlement.toUserId) ?? 0) - settlement.amountMinor);
    currencies.set(settlement.currency, balances);
  }

  return [...currencies.entries()].map(([currency, participantBalances]) => ({
    currency,
    balances: [...participantBalances.entries()].map<Balance>(([participantId, netMinor]) => ({
      participantId,
      netMinor,
    })),
  }));
}

/**
 * Calculate one normalized balance ledger in the trip's base currency.
 * Cross-currency rows without a confirmed conversion are intentionally omitted;
 * callers can surface those rows as needing a rate instead of guessing.
 */
export function calculateBalancesInCurrency(
  expenses: Expense[],
  participantIds: string[],
  settlements: Settlement[],
  baseCurrency: string,
) {
  const normalizedCurrency = baseCurrency.toUpperCase();
  const balances = new Map(participantIds.map((id) => [id, 0]));
  const unconvertedExpenseIds: string[] = [];
  const unconvertedSettlementIds: string[] = [];

  for (const expense of expenses) {
    const totalBaseMinor = expense.baseCurrency?.toUpperCase() === normalizedCurrency
      ? expense.baseAmountMinor
      : expense.currency.toUpperCase() === normalizedCurrency
        ? expense.totalMinor
        : undefined;
    if (totalBaseMinor === undefined) {
      unconvertedExpenseIds.push(expense.id);
      continue;
    }
    for (const payer of expense.payers) {
      const amount = payer.baseAmountMinor ?? Math.round(totalBaseMinor * payer.amountMinor / expense.totalMinor);
      balances.set(payer.userId, (balances.get(payer.userId) ?? 0) + amount);
    }
    for (const share of expense.shares) {
      const amount = share.baseAmountMinor ?? Math.round(totalBaseMinor * share.amountMinor / expense.totalMinor);
      balances.set(share.userId, (balances.get(share.userId) ?? 0) - amount);
    }
  }

  for (const settlement of settlements) {
    const amount = settlement.baseCurrency?.toUpperCase() === normalizedCurrency
      ? settlement.baseAmountMinor
      : settlement.currency.toUpperCase() === normalizedCurrency
        ? settlement.amountMinor
        : undefined;
    if (amount === undefined) {
      unconvertedSettlementIds.push(settlement.id);
      continue;
    }
    balances.set(settlement.fromUserId, (balances.get(settlement.fromUserId) ?? 0) + amount);
    balances.set(settlement.toUserId, (balances.get(settlement.toUserId) ?? 0) - amount);
  }

  return {
    currency: normalizedCurrency,
    balances: [...balances.entries()].map<Balance>(([participantId, netMinor]) => ({ participantId, netMinor })),
    unconvertedExpenseIds,
    unconvertedSettlementIds,
  };
}
