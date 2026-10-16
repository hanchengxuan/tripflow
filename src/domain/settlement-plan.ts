import { calculateBalancesInCurrency, calculateOutstandingBalancesByCurrency } from './ledger';
import type { Expense, Settlement } from './models';
import { minimizeSettlementTransfers } from './money';

export function buildSettlementPlan(expenses: Expense[], settlements: Settlement[], memberIds: string[], baseCurrency: string) {
  const normalized = calculateBalancesInCurrency(expenses, memberIds, settlements, baseCurrency);
  const hasCompleteConversions = normalized.unconvertedExpenseIds.length === 0 && normalized.unconvertedSettlementIds.length === 0;
  const needsReconciliation = !hasCompleteConversions && settlements.some(({ baseCurrency }) => baseCurrency !== undefined);
  const balances = needsReconciliation ? [] : hasCompleteConversions
    ? expenses.length || settlements.length ? [{ currency: baseCurrency, balances: normalized.balances }] : []
    : calculateOutstandingBalancesByCurrency(expenses, settlements, memberIds);
  const balanceSnapshots = balances.map(({ currency, balances: amounts }) => ({
    currency, outstandingTransfers: minimizeSettlementTransfers(amounts),
  }));
  const pendingTransfers = balanceSnapshots.flatMap(({ currency, outstandingTransfers }) => outstandingTransfers.map((transfer) => ({ ...transfer, currency })));
  return { hasCompleteConversions, needsReconciliation, balanceSnapshots, pendingTransfers };
}
