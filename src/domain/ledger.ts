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
