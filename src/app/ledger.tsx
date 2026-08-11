import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionButton, ChoiceChip, FormField, InlineNotice } from '@/components/form-controls';
import { InfoCard } from '@/components/info-card';
import { Screen } from '@/components/screen';
import { SelectionField } from '@/components/selection-field';
import { ThemedText } from '@/components/themed-text';
import { currencyOptions } from '@/constants/options';
import { calculateBalancesByCurrency, formatMinorAmount, parseAmountToMinor } from '@/domain/ledger';
import { minimizeSettlementTransfers } from '@/domain/money';
import { parseExpenseText } from '@/features/ai/expense-parser';
import { useMvp } from '@/features/mvp/mvp-provider';
import { toUserMessage } from '@/lib/user-error';

export default function LedgerScreen() {
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
        `AI 已生成草稿（置信度 ${confidence}%），请核对后再保存。`,
        ...draft.warnings,
      ].join(' '));
    } catch (caught) {
      setFormError(toUserMessage(caught, 'AI 解析失败，请换一种说法或手动填写。'));
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
      setSuccess('支出已保存，并完成精确均分。');
    } catch (caught) {
      setFormError(toUserMessage(caught, '无法保存支出，请稍后重试。'));
    } finally {
      setBusyAction(undefined);
    }
  }

  return (
    <Screen
      eyebrow="共享账本"
      title={activeTrip ? `${activeTrip.name} · 成员余额` : '暂无可用账本'}
      subtitle="不同币种分别计算；均分使用最小货币单位，结果可追溯且总额一致。">
      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
      {formError ? <InlineNotice tone="error">{formError}</InlineNotice> : null}
      {success ? <InlineNotice>{success}</InlineNotice> : null}
      {loading ? <InlineNotice>正在刷新账本…</InlineNotice> : null}

      {activeTrip ? (
        <InfoCard label="AI 快速录入" title="用一句话生成记账草稿" accent="#4B67D1">
          <View style={styles.form}>
            <FormField
              label="描述这笔支出"
              value={aiText}
              onChangeText={setAiText}
              placeholder="例如：晚餐 860 港币，小王付的，我、小王和小李均分"
              multiline
              numberOfLines={3}
              maxLength={500}
              style={styles.multiline}
            />
            <ThemedText type="small" themeColor="textSecondary">
              AI 只会填入下方草稿，不会自动保存或修改账本。请务必核对金额、付款人和分摊成员。
            </ThemedText>
            <ActionButton
              busy={busyAction === 'parse'}
              disabled={!aiText.trim() || Boolean(busyAction)}
              onPress={() => void parseWithAi()}>
              AI 解析并填入
            </ActionButton>
            {aiNotice ? <InlineNotice>{aiNotice}</InlineNotice> : null}
          </View>
        </InfoCard>
      ) : null}

      {activeTrip ? (
        <InfoCard label="确认草稿" title="核对并保存均分支出" accent="#0F9D7A">
          <View style={styles.form}>
            <FormField label="支出内容" value={title} onChangeText={setTitle} placeholder="例如：晚餐" />
            <View style={styles.row}>
              <View style={styles.grow}>
                <FormField label="金额" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="860.00" />
              </View>
              <View style={styles.currency}>
                <SelectionField label="币种" value={currency} options={currencyOptions} onChange={setCurrencyOverride} />
              </View>
            </View>
            <ThemedText type="smallBold">谁付款？</ThemedText>
            <View style={styles.chips}>
              {members.map((member) => (
                <ChoiceChip key={member.userId} selected={payerUserId === member.userId} onPress={() => setPayerOverride(member.userId)}>
                  {member.displayName}
                </ChoiceChip>
              ))}
            </View>
            <ThemedText type="smallBold">哪些人参与分摊？</ThemedText>
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
              保存均分支出
            </ActionButton>
          </View>
        </InfoCard>
      ) : (
        <InlineNotice>请先创建或加入一个行程，再开始记账。</InlineNotice>
      )}

      {balancesByCurrency.map(({ currency: balanceCurrency, balances }) => {
        const transfers = minimizeSettlementTransfers(balances);
        return (
          <InfoCard key={balanceCurrency} label={`${balanceCurrency} 余额`} title="成员收支关系" accent="#4B67D1">
            {balances.map((balance) => (
              <View key={balance.participantId} style={styles.balanceRow}>
                <ThemedText>{names.get(balance.participantId) ?? '同行者'}</ThemedText>
                <ThemedText type="smallBold" style={{ color: balance.netMinor >= 0 ? '#0F9D7A' : '#B4413E' }}>
                  {balance.netMinor >= 0 ? '+' : '−'}{formatMinorAmount(Math.abs(balance.netMinor), balanceCurrency)}
                </ThemedText>
              </View>
            ))}
            {transfers.length > 0 ? (
              <View style={styles.transferList}>
                <ThemedText type="smallBold">建议结算方式</ThemedText>
                {transfers.map((transfer) => (
                  <ThemedText key={`${transfer.fromParticipantId}-${transfer.toParticipantId}`} type="small" themeColor="textSecondary">
                    {names.get(transfer.fromParticipantId)} 向 {names.get(transfer.toParticipantId)} 支付 {formatMinorAmount(transfer.amountMinor, balanceCurrency)}
                  </ThemedText>
                ))}
              </View>
            ) : null}
          </InfoCard>
        );
      })}

      {expenses.length === 0 && activeTrip ? (
        <InfoCard label="账本已就绪" title="还没有支出">
          <ThemedText themeColor="textSecondary">保存第一笔支出后，这里会显示付款人与分摊明细。</ThemedText>
        </InfoCard>
      ) : expenses.map((expense) => (
        <InfoCard key={expense.id} label={new Date(expense.occurredAt).toLocaleString('zh-CN')} title={`${expense.title} · ${formatMinorAmount(expense.totalMinor, expense.currency)}`} accent="#E7863C">
          <ThemedText themeColor="textSecondary">
            {expense.payers.map(({ userId }) => names.get(userId) ?? '同行者').join('、')} 付款 · {expense.shares.length} 人分摊
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
