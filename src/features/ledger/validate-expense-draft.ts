import { InputError } from '@/domain/input-error';
import { convertMinorAmount, parseAmountToMinor, parseExchangeRate } from '@/domain/ledger';
import { assertAllocationsTotal } from '@/domain/money';

export function validateExpenseDraft(input: {
  tripId?: string;
  title: string;
  amount: string;
  currency: string;
  baseCurrency: string;
  exchangeRate: string;
  participantIds: string[];
  selectedPayerIds: string[];
  payerAmounts: Record<string, string>;
  allocationPreview: { participantId: string; amountMinor: number }[];
}) {
  if (!input.tripId) throw new InputError('请先选择一个行程。', 'Choose a trip before saving an expense.');
  if (!input.title.trim()) throw new InputError('请填写支出内容。', 'Enter what this expense was for.');
  if (!input.amount.trim()) throw new InputError('请填写金额。', 'Enter an amount.');
  if (!input.participantIds.length) throw new InputError('请至少选择一位分摊人。', 'Choose at least one person to share the expense.');
  if (!input.selectedPayerIds.length) throw new InputError('请至少选择一位付款人。', 'Choose at least one payer.');
  const totalMinor = parseAmountToMinor(input.amount, input.currency);
  const rate = input.currency.toUpperCase() === input.baseCurrency.toUpperCase() ? 1 : parseExchangeRate(input.exchangeRate);
  const baseAmountMinor = convertMinorAmount(totalMinor, input.currency, input.baseCurrency, rate);
  if (input.allocationPreview.length !== input.participantIds.length) throw new InputError('请完成分摊设置，并确保总额一致。', 'Complete the split and make sure it adds up to the total.');
  const payerAllocations = input.selectedPayerIds.length === 1
    ? [{ participantId: input.selectedPayerIds[0], amountMinor: totalMinor }]
    : input.selectedPayerIds.map((participantId) => {
      try { return { participantId, amountMinor: parseAmountToMinor(input.payerAmounts[participantId] ?? '', input.currency) }; }
      catch (error) {
        if (error instanceof InputError) throw new InputError(`付款金额：${error.message}`, `Payer amount: ${error.english}`);
        throw error;
      }
    });
  try { assertAllocationsTotal(totalMinor, payerAllocations, 'Payer amounts'); }
  catch { throw new InputError('付款金额合计必须等于支出总额。', 'Payer amounts must add up to the expense total.'); }
  return { totalMinor, rate, baseAmountMinor, payerAllocations };
}
