import { buildSettlementPlan } from '@/domain/settlement-plan';
import type { Expense, Settlement } from '@/domain/models';
import { settlementPayment } from '../settlement-payment';

const expense: Expense = {
  id: 'expense', tripId: 'trip', title: 'Historical expense', currency: 'JPY', totalMinor: 1000,
  baseCurrency: 'HKD', baseAmountMinor: 5000, exchangeRate: 0.5,
  occurredAt: '2026-10-16T00:00:00Z', source: 'manual',
  payers: [{ userId: 'a', amountMinor: 1000, baseAmountMinor: 5000 }],
  shares: [{ userId: 'b', amountMinor: 1000, baseAmountMinor: 5000 }],
};
const members = ['a', 'b'];

test('a different trip home currency keeps tasks, totals and payment in the original currency', () => {
  const plan = buildSettlementPlan([expense], [], members, 'AUD');
  expect(plan.hasCompleteConversions).toBe(false);
  expect(plan.balanceSnapshots).toEqual([{ currency: 'JPY', outstandingTransfers: [{ fromParticipantId: 'b', toParticipantId: 'a', amountMinor: 1000 }] }]);
  const transfer = plan.pendingTransfers[0];
  expect(settlementPayment({ transfer, baseCurrency: 'AUD', hasCompleteConversions: false })).toEqual({ toUserId: 'a', currency: 'JPY', amountMinor: 1000 });
});

test('a source-currency payment reduces the same displayed debt; undo restores it', () => {
  const settlement: Settlement = { id: 'sent', tripId: 'trip', fromUserId: 'b', toUserId: 'a', currency: 'JPY', amountMinor: 400, recordedBy: 'b', settledAt: '2026-10-16T00:00:00Z' };
  const plan = buildSettlementPlan([expense], [settlement], members, 'AUD');
  expect(plan.pendingTransfers[0]).toEqual({ currency: 'JPY', fromParticipantId: 'b', toParticipantId: 'a', amountMinor: 600 });
  expect(buildSettlementPlan([expense], [{ ...settlement, amountMinor: 1000 }], members, 'AUD').pendingTransfers).toEqual([]);
  expect(buildSettlementPlan([expense], [], members, 'AUD').pendingTransfers[0].amountMinor).toBe(1000);
});

test('valid conversions still settle in the trip home currency', () => {
  const plan = buildSettlementPlan([expense], [], members, 'HKD');
  expect(plan.hasCompleteConversions).toBe(true);
  expect(settlementPayment({ transfer: plan.pendingTransfers[0], baseCurrency: 'HKD', hasCompleteConversions: true })).toEqual({
    toUserId: 'a', currency: 'HKD', amountMinor: 5000, baseCurrency: 'HKD', baseAmountMinor: 5000, exchangeRate: 1, exchangeRateSource: 'manual',
  });
});

test('source-currency settlement refuses a different payment currency and overpayment', () => {
  const transfer = buildSettlementPlan([expense], [], members, 'AUD').pendingTransfers[0];
  expect(() => settlementPayment({ transfer, baseCurrency: 'AUD', hasCompleteConversions: false, draft: { currency: 'AUD', amount: '10', rate: '1' } })).toThrow('币种');
  expect(() => settlementPayment({ transfer, baseCurrency: 'AUD', hasCompleteConversions: false, draft: { currency: 'JPY', amount: '1001', rate: '1' } })).toThrow('超过');
});

test('mixed currencies remain separate instead of producing a false home-currency zero', () => {
  const other: Expense = { ...expense, id: 'other', currency: 'HKD', totalMinor: 2000, payers: [{ userId: 'b', amountMinor: 2000 }], shares: [{ userId: 'a', amountMinor: 2000 }] };
  const plan = buildSettlementPlan([expense, other], [], members, 'AUD');
  expect(plan.pendingTransfers).toEqual([
    { currency: 'JPY', fromParticipantId: 'b', toParticipantId: 'a', amountMinor: 1000 },
    { currency: 'HKD', fromParticipantId: 'a', toParticipantId: 'b', amountMinor: 2000 },
  ]);
});


test('prior converted payments block original-currency fallback until rates are reconciled', () => {
  const settlement: Settlement = { id: 'converted', tripId: 'trip', fromUserId: 'b', toUserId: 'a', currency: 'HKD', amountMinor: 5000, baseCurrency: 'HKD', baseAmountMinor: 5000, exchangeRate: 1, recordedBy: 'b', settledAt: '2026-10-16T00:00:00Z' };
  const plan = buildSettlementPlan([expense], [settlement], members, 'AUD');
  expect(plan.needsReconciliation).toBe(true);
  expect(plan.pendingTransfers).toEqual([]);
  expect(() => settlementPayment({ transfer: { currency: 'JPY', fromParticipantId: 'b', toParticipantId: 'a', amountMinor: 1000 }, baseCurrency: 'AUD', hasCompleteConversions: false, needsReconciliation: true })).toThrow('汇率');
});
