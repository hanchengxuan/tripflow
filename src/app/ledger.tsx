import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionButton, ChoiceChip, FormField, InlineNotice } from '@/components/form-controls';
import { InfoCard } from '@/components/info-card';
import { Screen } from '@/components/screen';
import { SelectionField } from '@/components/selection-field';
import { ThemedText } from '@/components/themed-text';
import { getCurrencyOptions } from '@/constants/options';
import { calculateBalancesByCurrency, formatMinorAmount, parseAmountToMinor } from '@/domain/ledger';
import { minimizeSettlementTransfers } from '@/domain/money';
import { parseExpenseText } from '@/features/ai/expense-parser';
import { useMvp } from '@/features/mvp/mvp-provider';
import { toUserMessage } from '@/lib/user-error';
import { useI18n } from '@/features/i18n/i18n-provider';

export default function LedgerScreen() {
  const { locale, formatDateTime, tx } = useI18n();
  const { activeTrip, members, expenses, currentUserId, addEqualExpense, loading, error } = useMvp();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currencyOverride, setCurrencyOverride] = useState('');
  const [payerOverride, setPayerOverride] = useState('');
  const [participantsByTrip, setParticipantsByTrip] = useState<Record<string, string[]>>({});
  const [aiText, setAiText] = useState('');
  const [busyAction, setBusyAction] = useState<'parse' | 'save'>();
  const [formError, setFormError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [aiNotice, setAiNotice] = useState<string>();

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
  const currencyOptions = getCurrencyOptions(locale === 'en');

  function toggleParticipant(userId: string) {
    if (!activeTrip) return;
    setParticipantsByTrip((current) => ({
      ...current,
      [activeTrip.id]: participantIds.includes(userId)
        ? participantIds.filter((id) => id !== userId)
        : [...participantIds, userId],
    }));
  }

  async function parseWithAi() {
    if (!activeTrip) return;
    setBusyAction('parse');
    setFormError(undefined);
    setSuccess(undefined);
    setAiNotice(undefined);
    try {
      const draft = await parseExpenseText({
        tripId: activeTrip.id,
        text: aiText,
        memberIds: members.map(({ userId }) => userId),
      });
      setTitle(draft.title);
      setAmount(draft.amount);
      setCurrencyOverride(draft.currency);
      setPayerOverride(draft.payerUserId);
      setParticipantsByTrip((current) => ({ ...current, [activeTrip.id]: draft.participantUserIds }));
      const confidence = Math.round(draft.confidence * 100);
      setAiNotice([
        tx(`AI 已生成草稿（置信度 ${confidence}%），请核对后再保存。`, `AI created a draft (${confidence}% confidence). Review it before saving.`),
        ...draft.warnings,
      ].join(' '));
    } catch (caught) {
      setFormError(toUserMessage(caught, tx('AI 解析失败，请换一种说法或手动填写。', 'AI could not parse that. Rephrase it or enter the details manually.')));
    } finally {
      setBusyAction(undefined);
    }
  }

  async function submitExpense() {
    setBusyAction('save');
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
      setAiText('');
      setAiNotice(undefined);
      setSuccess(tx('支出已保存，并完成精确均分。', 'Expense saved and split exactly.'));
    } catch (caught) {
      setFormError(toUserMessage(caught, tx('无法保存支出，请稍后重试。', 'Could not save the expense. Please try again.')));
    } finally {
      setBusyAction(undefined);
    }
  }

  return (
    <Screen
      meta={tx('共享账本', 'Shared ledger')}
      title={activeTrip ? tx(`${activeTrip.name} · 成员余额`, `${activeTrip.name} · balances`) : tx('暂无可用账本', 'No ledger yet')}
      subtitle={tx('不同币种分别计算；均分使用最小货币单位，结果可追溯且总额一致。', 'Currencies stay separate. Every split is exact, traceable, and adds back to the total.') }>
      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
      {formError ? <InlineNotice tone="error">{formError}</InlineNotice> : null}
      {success ? <InlineNotice>{success}</InlineNotice> : null}
      {loading ? <InlineNotice>{tx('正在刷新账本…', 'Refreshing the ledger…')}</InlineNotice> : null}

      {activeTrip ? (
        <InfoCard label={tx('AI 快速录入', 'AI quick entry')} title={tx('用一句话生成记账草稿', 'Turn one sentence into a draft')} accent="#1B70A6">
          <View style={styles.form}>
            <FormField
              label={tx('描述这笔支出', 'Describe the expense')}
              value={aiText}
              onChangeText={setAiText}
              placeholder={tx('例如：晚餐 860 港币，小王付的，我、小王和小李均分', 'For example: Dinner was HKD 860, paid by Sam and split with Liam and Jo')}
              multiline
              numberOfLines={3}
              maxLength={500}
              style={styles.multiline}
            />
            <ThemedText type="small" themeColor="textSecondary">
              {tx('AI 只会填入下方草稿，不会自动保存或修改账本。请务必核对金额、付款人和分摊成员。', 'AI only fills the draft below. It never saves or changes the ledger automatically. Check the amount, payer, and group.')}
            </ThemedText>
            <ActionButton
              busy={busyAction === 'parse'}
              disabled={!aiText.trim() || Boolean(busyAction)}
              onPress={() => void parseWithAi()}>
              {tx('AI 解析并填入', 'Create AI draft')}
            </ActionButton>
            {aiNotice ? <InlineNotice>{aiNotice}</InlineNotice> : null}
          </View>
        </InfoCard>
      ) : null}

      {activeTrip ? (
        <InfoCard label={tx('确认草稿', 'Confirm draft')} title={tx('核对并保存均分支出', 'Review and save the split')} accent="#087F6A">
          <View style={styles.form}>
            <FormField label={tx('支出内容', 'Expense')} value={title} onChangeText={setTitle} placeholder={tx('例如：晚餐', 'For example: Dinner')} />
            <View style={styles.row}>
              <View style={styles.grow}>
                <FormField label={tx('金额', 'Amount')} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="860.00" />
              </View>
              <View style={styles.currency}>
                <SelectionField label={tx('币种', 'Currency')} value={currency} options={currencyOptions} onChange={setCurrencyOverride} />
              </View>
            </View>
            <ThemedText type="smallBold">{tx('谁付款？', 'Who paid?')}</ThemedText>
            <View style={styles.chips}>
              {members.map((member) => (
                <ChoiceChip key={member.userId} selected={payerUserId === member.userId} onPress={() => setPayerOverride(member.userId)}>
                  {member.displayName}
                </ChoiceChip>
              ))}
            </View>
            <ThemedText type="smallBold">{tx('哪些人参与分摊？', 'Who is sharing it?')}</ThemedText>
            <View style={styles.chips}>
              {members.map((member) => (
                <ChoiceChip key={member.userId} selected={participantIds.includes(member.userId)} onPress={() => toggleParticipant(member.userId)}>
                  {member.displayName}
                </ChoiceChip>
              ))}
            </View>
            <ActionButton
              busy={busyAction === 'save'}
              disabled={Boolean(busyAction) || !title.trim() || !amount.trim() || participantIds.length === 0 || !payerUserId}
              onPress={submitExpense}>
              {tx('保存均分支出', 'Save split expense')}
            </ActionButton>
          </View>
        </InfoCard>
      ) : (
        <InlineNotice>{tx('请先创建或加入一个行程，再开始记账。', 'Create or join a trip before adding expenses.')}</InlineNotice>
      )}

      {balancesByCurrency.map(({ currency: balanceCurrency, balances }) => {
        const transfers = minimizeSettlementTransfers(balances);
        return (
          <InfoCard key={balanceCurrency} label={tx(`${balanceCurrency} 余额`, `${balanceCurrency} balances`)} title={tx('成员收支关系', 'Who is ahead or behind')} accent="#1B70A6">
            {balances.map((balance) => (
              <View key={balance.participantId} style={styles.balanceRow}>
                <ThemedText>{names.get(balance.participantId) ?? tx('同行者', 'Traveller')}</ThemedText>
                <ThemedText type="smallBold" style={{ color: balance.netMinor >= 0 ? '#0F9D7A' : '#B4413E' }}>
                  {balance.netMinor >= 0 ? '+' : '−'}{formatMinorAmount(Math.abs(balance.netMinor), balanceCurrency)}
                </ThemedText>
              </View>
            ))}
            {transfers.length > 0 ? (
              <View style={styles.transferList}>
                <ThemedText type="smallBold">{tx('建议结算方式', 'Suggested settlement')}</ThemedText>
                {transfers.map((transfer) => (
                  <ThemedText key={`${transfer.fromParticipantId}-${transfer.toParticipantId}`} type="small" themeColor="textSecondary">
                    {tx(`${names.get(transfer.fromParticipantId)} 向 ${names.get(transfer.toParticipantId)} 支付 ${formatMinorAmount(transfer.amountMinor, balanceCurrency)}`, `${names.get(transfer.fromParticipantId)} pays ${names.get(transfer.toParticipantId)} ${formatMinorAmount(transfer.amountMinor, balanceCurrency)}`)}
                  </ThemedText>
                ))}
              </View>
            ) : null}
          </InfoCard>
        );
      })}

      {expenses.length === 0 && activeTrip ? (
        <InfoCard label={tx('账本已就绪', 'Ledger ready')} title={tx('还没有支出', 'No expenses yet')}>
          <ThemedText themeColor="textSecondary">{tx('保存第一笔支出后，这里会显示付款人与分摊明细。', 'Save the first expense to see payers and shares here.')}</ThemedText>
        </InfoCard>
      ) : expenses.map((expense) => (
        <InfoCard key={expense.id} label={formatDateTime(expense.occurredAt)} title={`${expense.title} · ${formatMinorAmount(expense.totalMinor, expense.currency)}`} accent="#D86E35">
          <ThemedText themeColor="textSecondary">
            {tx(`${expense.payers.map(({ userId }) => names.get(userId) ?? '同行者').join('、')} 付款 · ${expense.shares.length} 人分摊`, `Paid by ${expense.payers.map(({ userId }) => names.get(userId) ?? 'Traveller').join(', ')} · split with ${expense.shares.length}`)}
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
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  transferList: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#A8BAB3', paddingTop: 10, gap: 4 },
});
