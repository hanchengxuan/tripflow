import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionButton, ChoiceChip, FormField, InlineNotice } from '@/components/form-controls';
import { InfoCard } from '@/components/info-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { calculateBalancesByCurrency, formatMinorAmount, parseAmountToMinor } from '@/domain/ledger';
import { minimizeSettlementTransfers } from '@/domain/money';
import { useMvp } from '@/features/mvp/mvp-provider';

export default function LedgerScreen() {
  const { activeTrip, members, expenses, currentUserId, addEqualExpense, loading, error } = useMvp();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currencyOverride, setCurrencyOverride] = useState('');
  const [payerOverride, setPayerOverride] = useState('');
  const [participantsByTrip, setParticipantsByTrip] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [success, setSuccess] = useState<string>();

  const currency = currencyOverride || activeTrip?.homeCurrency || 'HKD';
  const payerUserId = members.some(({ userId }) => userId === payerOverride) ? payerOverride : currentUserId;
  const participantIds = activeTrip
    ? participantsByTrip[activeTrip.id] ?? members.map(({ userId }) => userId)
    : [];

  const names = useMemo(() => new Map(members.map(({ userId, displayName }) => [userId, displayName])), [members]);
  const balancesByCurrency = useMemo(
    () => calculateBalancesByCurrency(expenses, members.map(({ userId }) => userId)),
    [expenses, members],
  );

  function toggleParticipant(userId: string) {
    if (!activeTrip) return;
    setParticipantsByTrip((current) => ({
      ...current,
      [activeTrip.id]: participantIds.includes(userId)
        ? participantIds.filter((id) => id !== userId)
        : [...participantIds, userId],
    }));
  }

  async function submitExpense() {
    setBusy(true);
    setFormError(undefined);
    setSuccess(undefined);
    try {
      const totalMinor = parseAmountToMinor(amount, currency);
      await addEqualExpense({
        title,
        currency: currency.toUpperCase(),
        totalMinor,
        payerUserId,
        participantUserIds: participantIds,
      });
      setTitle('');
      setAmount('');
      setSuccess('Expense saved and split exactly.');
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Could not save the expense.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      eyebrow="Group ledger"
      title={activeTrip ? `${activeTrip.name} balances` : 'No active ledger'}
      subtitle="Original currencies stay separate. Equal splits use deterministic minor-unit rounding.">
      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
      {formError ? <InlineNotice tone="error">{formError}</InlineNotice> : null}
      {success ? <InlineNotice>{success}</InlineNotice> : null}
      {loading ? <InlineNotice>Refreshing the ledger…</InlineNotice> : null}

      {activeTrip ? (
        <InfoCard label="QUICK EXPENSE" title="Record and split equally" accent="#0F9D7A">
          <View style={styles.form}>
            <FormField label="What was it?" value={title} onChangeText={setTitle} placeholder="Dinner" />
            <View style={styles.row}>
              <View style={styles.grow}>
                <FormField label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="860.00" />
              </View>
              <View style={styles.currency}>
                <FormField label="Currency" value={currency} onChangeText={setCurrencyOverride} autoCapitalize="characters" maxLength={3} />
              </View>
            </View>
            <ThemedText type="smallBold">Who paid?</ThemedText>
            <View style={styles.chips}>
              {members.map((member) => (
                <ChoiceChip key={member.userId} selected={payerUserId === member.userId} onPress={() => setPayerOverride(member.userId)}>
                  {member.displayName}
                </ChoiceChip>
              ))}
            </View>
            <ThemedText type="smallBold">Who shares it?</ThemedText>
            <View style={styles.chips}>
              {members.map((member) => (
                <ChoiceChip key={member.userId} selected={participantIds.includes(member.userId)} onPress={() => toggleParticipant(member.userId)}>
                  {member.displayName}
                </ChoiceChip>
              ))}
            </View>
            <ActionButton
              busy={busy}
              disabled={!title.trim() || !amount.trim() || participantIds.length === 0 || !payerUserId}
              onPress={submitExpense}>
              Save equal split
            </ActionButton>
          </View>
        </InfoCard>
      ) : (
        <InlineNotice>Create or join a trip before recording expenses.</InlineNotice>
      )}

      {balancesByCurrency.map(({ currency: balanceCurrency, balances }) => {
        const transfers = minimizeSettlementTransfers(balances);
        return (
          <InfoCard key={balanceCurrency} label={`${balanceCurrency} BALANCES`} title="Who owes whom" accent="#4B67D1">
            {balances.map((balance) => (
              <View key={balance.participantId} style={styles.balanceRow}>
                <ThemedText>{names.get(balance.participantId) ?? 'Traveler'}</ThemedText>
                <ThemedText type="smallBold" style={{ color: balance.netMinor >= 0 ? '#0F9D7A' : '#B4413E' }}>
                  {balance.netMinor >= 0 ? '+' : '−'}{formatMinorAmount(Math.abs(balance.netMinor), balanceCurrency)}
                </ThemedText>
              </View>
            ))}
            {transfers.length > 0 ? (
              <View style={styles.transferList}>
                <ThemedText type="smallBold">Suggested settlement</ThemedText>
                {transfers.map((transfer) => (
                  <ThemedText key={`${transfer.fromParticipantId}-${transfer.toParticipantId}`} type="small" themeColor="textSecondary">
                    {names.get(transfer.fromParticipantId)} pays {names.get(transfer.toParticipantId)} {formatMinorAmount(transfer.amountMinor, balanceCurrency)}
                  </ThemedText>
                ))}
              </View>
            ) : null}
          </InfoCard>
        );
      })}

      {expenses.length === 0 && activeTrip ? (
        <InfoCard label="LEDGER READY" title="No expenses yet">
          <ThemedText themeColor="textSecondary">The first saved expense will appear here with payer and share details.</ThemedText>
        </InfoCard>
      ) : expenses.map((expense) => (
        <InfoCard key={expense.id} label={new Date(expense.occurredAt).toLocaleString()} title={`${expense.title} · ${formatMinorAmount(expense.totalMinor, expense.currency)}`} accent="#E7863C">
          <ThemedText themeColor="textSecondary">
            {expense.payers.map(({ userId }) => names.get(userId) ?? 'Traveler').join(', ')} paid · {expense.shares.length} shares
          </ThemedText>
        </InfoCard>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  grow: { flex: 1 },
  currency: { width: 110 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  transferList: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#A8BAB3', paddingTop: 10, gap: 4 },
});
