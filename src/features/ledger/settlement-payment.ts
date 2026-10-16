import { convertMinorAmount, currencyMinorDigits, parseAmountToMinor, parseExchangeRate } from '@/domain/ledger';
import { InputError } from '@/domain/input-error';
import type { SettlementTransfer } from '@/domain/money';

export function settlementPayment({ transfer, draft, baseCurrency, hasCompleteConversions, needsReconciliation = false }: {
  transfer: SettlementTransfer & { currency: string };
  draft?: { currency: string; amount: string; rate: string };
  baseCurrency: string;
  hasCompleteConversions: boolean;
  needsReconciliation?: boolean;
}) {
  if (needsReconciliation) throw new InputError('请先补全账单汇率，再继续结算。', 'Complete the expense exchange rates before recording another payment.');
  const payment = draft ?? {
    currency: transfer.currency,
    amount: (transfer.amountMinor / 10 ** currencyMinorDigits(transfer.currency)).toFixed(currencyMinorDigits(transfer.currency)),
    rate: '1',
  };
  const amountMinor = parseAmountToMinor(payment.amount, payment.currency);
  if (!hasCompleteConversions) {
    if (payment.currency !== transfer.currency) throw new InputError('请按待转账币种付款，或先补全账单汇率。', 'Pay in the currency due, or complete the expense exchange rates first.');
    if (amountMinor > transfer.amountMinor) throw new InputError('转账金额不能超过待转余额。', 'The payment cannot exceed the amount due.');
    return { toUserId: transfer.toParticipantId, currency: payment.currency, amountMinor };
  }
  const exchangeRate = payment.currency.toUpperCase() === baseCurrency.toUpperCase() ? 1 : parseExchangeRate(payment.rate);
  const baseAmountMinor = convertMinorAmount(amountMinor, payment.currency, baseCurrency, exchangeRate);
  if (baseAmountMinor > transfer.amountMinor) throw new InputError('折算金额不能超过待转余额。', 'The converted amount cannot exceed the amount due.');
  return { toUserId: transfer.toParticipantId, currency: payment.currency, amountMinor, baseCurrency, baseAmountMinor, exchangeRate, exchangeRateSource: 'manual' };
}
