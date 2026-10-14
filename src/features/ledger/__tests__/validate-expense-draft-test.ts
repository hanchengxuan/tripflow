import { currencyAmountPlaceholder, parseAmountToMinor } from '@/domain/ledger';
import { toUserMessage } from '@/lib/user-error';
import { validateExpenseDraft } from '../validate-expense-draft';

const valid = { tripId: 'trip', title: 'Dinner', amount: '860', currency: 'JPY', baseCurrency: 'JPY', exchangeRate: '1', participantIds: ['a'], selectedPayerIds: ['a'], payerAmounts: {}, allocationPreview: [{ participantId: 'a', amountMinor: 860 }] };
function message(input: Partial<typeof valid>, locale: 'en' | 'zh-CN') {
  try { validateExpenseDraft({ ...valid, ...input }); return ''; }
  catch (error) { return toUserMessage(error, 'fallback', locale); }
}
test.each(['JPY', 'KRW', 'HKD', 'USD'])('%s accepts its displayed amount example', (currency) => {
  expect(parseAmountToMinor(currencyAmountPlaceholder(currency), currency)).toBeGreaterThan(0);
});
test('empty title is identified in English instead of the generic money fallback', () => {
  expect(message({ title: '' }, 'en')).toBe('Enter what this expense was for.');
});
test('integer-only currency validation follows the chosen language', () => {
  expect(message({ amount: '860.00' }, 'en')).toMatch(/whole number/);
  expect(message({ amount: '860.00' }, 'zh-CN')).toBe('该币种请输入整数金额。');
});
test('invalid input never changes the deterministic accepted total', () => {
  expect(validateExpenseDraft(valid)).toMatchObject({ totalMinor: 860, baseAmountMinor: 860, rate: 1 });
  expect(message({ amount: '0' }, 'en')).toMatch(/positive/);
  expect(message({ currency: 'USD', exchangeRate: '0' }, 'en')).toMatch(/rate/);
});
test('payer mismatch gives a safe actionable message', () => {
  expect(message({ selectedPayerIds: ['a', 'b'], payerAmounts: { a: '400', b: '400' } }, 'en')).toMatch(/add up/);
});
test('untrusted errors cannot opt into public validation messages', () => {
  expect(toUserMessage(new Error('internal provider detail'), 'Try again', 'en')).toBe('Try again');
  expect(toUserMessage({ message: '内部错误和私密细节' }, 'Try again', 'en')).toBe('Try again');
});
