import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useMemo, useState } from 'react';
import { LayoutAnimation, Linking, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ActionButton, ChoiceChip, FormField, InlineNotice } from '@/components/form-controls';
import { Chevron } from '@/components/chevron';
import { MemberAvatar } from '@/components/member-avatar';
import { Screen } from '@/components/screen';
import { SelectionField } from '@/components/selection-field';
import { SectionHeading } from '@/components/section-heading';
import { ThemedText } from '@/components/themed-text';
import { getCurrencyOptions } from '@/constants/options';
import {
  calculateBalancesByCurrency,
  calculateOutstandingBalancesByCurrency,
  calculateBalancesInCurrency,
  convertMinorAmount,
  currencyMinorDigits,
  formatMinorAmount,
  parseExchangeRate,
  parseAmountToMinor,
} from '@/domain/ledger';
import { assertAllocationsTotal, minimizeSettlementTransfers, splitByExactAmounts, splitByPercentages, splitByWeights, splitEqually, type SettlementTransfer } from '@/domain/money';
import type { Expense, Settlement, TripMember } from '@/domain/models';
import { type AiExpenseDraft, parseExpenseAudio, parseExpenseText } from '@/features/ai/expense-parser';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useMvp } from '@/features/mvp/mvp-provider';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/user-error';

type ReceiptDraft = {
  uri: string;
  base64?: string | null;
  mimeType?: string | null;
  fileSize?: number;
};

type BalanceSnapshot = {
  currency: string;
  outstandingTransfers: SettlementTransfer[];
};

type SettlementDraft = { currency: string; amount: string; rate: string };

function defaultAllocationValueFor(mode: 'equal' | 'exact' | 'percentage' | 'shares', index: number, count: number) {
  if (mode === 'shares') return '1';
  if (mode === 'percentage') {
    const base = Math.floor(100 / Math.max(count, 1));
    return String(base + (index < 100 % Math.max(count, 1) ? 1 : 0));
  }
  return '';
}

export default function LedgerScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 520;
  const { locale, formatDateTime, tx } = useI18n();
  const {
    activeTrip,
    members,
    ledgerMembers,
    expenses,
    settlements,
    currentUserId,
    addCustomExpense,
    updateCustomExpense,
    attachExpenseReceipt,
    markSettlement,
    unmarkSettlement,
    error,
  } = useMvp();
  const [activeView, setActiveView] = useState<'settle' | 'activity'>('settle');
  const [showGroupSettlement, setShowGroupSettlement] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerOffset, setComposerOffset] = useState<number>();
  const [editingExpenseId, setEditingExpenseId] = useState<string>();
  const [entryMode, setEntryMode] = useState<'manual' | 'ai'>('manual');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currencyOverride, setCurrencyOverride] = useState('');
  const [exchangeRate, setExchangeRate] = useState('1');
  const [payerOverride, setPayerOverride] = useState('');
  const [payerIds, setPayerIds] = useState<string[]>([]);
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>({});
  const [splitMode, setSplitMode] = useState<'equal' | 'exact' | 'percentage' | 'shares'>('equal');
  const [allocationValues, setAllocationValues] = useState<Record<string, string>>({});
  const [participantsByTrip, setParticipantsByTrip] = useState<Record<string, string[]>>({});
  const [aiText, setAiText] = useState('');
  const [receipt, setReceipt] = useState<ReceiptDraft>();
  const [expandedExpenseId, setExpandedExpenseId] = useState<string>();
  const [busyAction, setBusyAction] = useState<'parse' | 'save' | 'receipt'>();
  const [busySettlementId, setBusySettlementId] = useState<string>();
  const [settlementDrafts, setSettlementDrafts] = useState<Record<string, SettlementDraft>>({});
  const [expandedSettlementKey, setExpandedSettlementKey] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [aiNotice, setAiNotice] = useState<string>();

  const currency = currencyOverride || activeTrip?.homeCurrency || 'HKD';
  const baseCurrency = activeTrip?.homeCurrency || 'HKD';
  const payerUserId = members.some(({ userId }) => userId === payerOverride) ? payerOverride : currentUserId;
  const selectedPayerIds = payerIds.length > 0 ? payerIds : [payerUserId];
  const participantIds = useMemo(
    () => activeTrip ? participantsByTrip[activeTrip.id] ?? members.map(({ userId }) => userId) : [],
    [activeTrip, members, participantsByTrip],
  );
  const names = useMemo(() => new Map(ledgerMembers.map(({ userId, displayName }) => [userId, displayName])), [ledgerMembers]);
  const memberById = useMemo(() => new Map(ledgerMembers.map((member) => [member.userId, member])), [ledgerMembers]);
  const memberIds = useMemo(() => ledgerMembers.map(({ userId }) => userId), [ledgerMembers]);
  const currencyOptions = getCurrencyOptions(locale === 'en');
  const darkMode = theme.background === '#0C1924';
  const positiveColor = darkMode ? '#69D4BC' : '#087F6A';
  const dangerColor = darkMode ? '#FF9B96' : '#B4413E';
  const linkColor = darkMode ? '#8DD8FF' : '#1B70A6';

  const allocationPreview = useMemo(() => {
    if (!amount.trim() || participantIds.length === 0) return [];
    try {
      const totalMinor = parseAmountToMinor(amount, currency);
      if (splitMode === 'equal') return splitEqually(totalMinor, participantIds);
      if (splitMode === 'exact') return splitByExactAmounts(totalMinor, participantIds.map((participantId) => ({ participantId, amountMinor: parseAmountToMinor(allocationValues[participantId] ?? '', currency) })));
      if (splitMode === 'percentage') return splitByPercentages(totalMinor, participantIds.map((participantId, index) => ({ participantId, percentage: Number(allocationValues[participantId] ?? defaultAllocationValueFor(splitMode, index, participantIds.length)) })));
      return splitByWeights(totalMinor, participantIds.map((participantId, index) => ({ participantId, weight: Number(allocationValues[participantId] ?? defaultAllocationValueFor(splitMode, index, participantIds.length)) })));
    } catch {
      return [];
    }
  }, [allocationValues, amount, currency, participantIds, splitMode]);

  function chooseCurrency(nextCurrency: string) {
    setCurrencyOverride(nextCurrency);
    setExchangeRate(nextCurrency.toUpperCase() === baseCurrency.toUpperCase() ? '1' : '');
  }

  const balanceSnapshots = useMemo<BalanceSnapshot[]>(() => {
    const gross = calculateBalancesByCurrency(expenses, memberIds);
    const outstanding = calculateOutstandingBalancesByCurrency(expenses, settlements, memberIds);
    const outstandingByCurrency = new Map(outstanding.map((item) => [item.currency, item.balances]));
    return gross.map(({ currency: balanceCurrency, balances }) => ({
      currency: balanceCurrency,
      outstandingTransfers: minimizeSettlementTransfers(outstandingByCurrency.get(balanceCurrency) ?? balances),
    }));
  }, [expenses, settlements, memberIds]);

  const sourcePendingTransfers = balanceSnapshots.flatMap(({ currency: itemCurrency, outstandingTransfers }) =>
    outstandingTransfers.map((transfer) => ({ ...transfer, currency: itemCurrency })),
  );
  const normalizedBalance = useMemo(
    () => activeTrip ? calculateBalancesInCurrency(expenses, memberIds, settlements, baseCurrency) : undefined,
    [activeTrip, baseCurrency, expenses, memberIds, settlements],
  );
  const normalizedPendingTransfers = useMemo(
    () => normalizedBalance && normalizedBalance.unconvertedExpenseIds.length === 0 && normalizedBalance.unconvertedSettlementIds.length === 0
      ? minimizeSettlementTransfers(normalizedBalance.balances).map((transfer) => ({ ...transfer, currency: baseCurrency }))
      : [],
    [baseCurrency, normalizedBalance],
  );
  const hasCompleteConversions = normalizedBalance?.unconvertedExpenseIds.length === 0
    && normalizedBalance?.unconvertedSettlementIds.length === 0;
  const pendingTransfers = hasCompleteConversions ? normalizedPendingTransfers : sourcePendingTransfers;
  const myPendingTransfers = pendingTransfers.filter(({ fromParticipantId }) => fromParticipantId === currentUserId);
  const myIncomingTransfers = pendingTransfers.filter(({ toParticipantId }) => toParticipantId === currentUserId);
  const currentMember = ledgerMembers.find(({ userId }) => userId === currentUserId);
  const settlementStatusByUser = useMemo(() => {
    const statuses = new Map<string, { label: string; color?: string }>();
    for (const member of ledgerMembers) {
      const outgoing = pendingTransfers.find(({ fromParticipantId }) => fromParticipantId === member.userId);
      const completedOutgoing = settlements.find(({ fromUserId }) => fromUserId === member.userId);
      const completedIncoming = settlements.find(({ toUserId }) => toUserId === member.userId);
      statuses.set(member.userId, outgoing
        ? { label: tx(`待转给 ${names.get(outgoing.toParticipantId) ?? '同行者'}`, `Pending to ${names.get(outgoing.toParticipantId) ?? 'traveller'}`), color: dangerColor }
        : completedOutgoing
          ? { label: tx('已转账', 'Sent') }
          : completedIncoming
            ? { label: tx('已收款', 'Received'), color: positiveColor }
            : { label: tx('待结算', 'Pending') });
    }
    return statuses;
  }, [dangerColor, ledgerMembers, names, pendingTransfers, positiveColor, settlements, tx]);

  function chooseEntryMode(mode: 'ai' | 'manual') {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setEntryMode(mode);
  }

  function resetExpenseForm() {
    setEditingExpenseId(undefined);
    setTitle('');
    setAmount('');
    setCurrencyOverride('');
    setExchangeRate('1');
    setPayerOverride('');
    setPayerIds([]);
    setPayerAmounts({});
    setAllocationValues({});
    setSplitMode('equal');
    setAiText('');
    setReceipt(undefined);
    setAiNotice(undefined);
    setFormError(undefined);
  }

  function closeComposer() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setComposerOffset(undefined);
    setComposerOpen(false);
    resetExpenseForm();
    setSuccess(undefined);
  }

  function toggleComposer() {
    if (composerOpen) {
      closeComposer();
      return;
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setComposerOffset(undefined);
    resetExpenseForm();
    setComposerOpen(true);
    setFormError(undefined);
    setSuccess(undefined);
  }

  function startEditingExpense(expense: Expense) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveView('activity');
    setComposerOffset(undefined);
    setComposerOpen(true);
    setEditingExpenseId(expense.id);
    setEntryMode('manual');
    setTitle(expense.title);
    setAmount(amountInputFromMinor(expense.totalMinor, expense.currency));
    setCurrencyOverride(expense.currency);
    setExchangeRate(expense.exchangeRate ? String(expense.exchangeRate) : expense.currency.toUpperCase() === baseCurrency.toUpperCase() ? '1' : '');
    setPayerIds(expense.payers.map(({ userId }) => userId));
    setPayerOverride(expense.payers[0]?.userId ?? currentUserId);
    setPayerAmounts(Object.fromEntries(expense.payers.map(({ userId, amountMinor }) => [userId, amountInputFromMinor(amountMinor, expense.currency)])));
    setParticipantsByTrip((current) => ({ ...current, [expense.tripId]: expense.shares.map(({ userId }) => userId) }));
    setSplitMode('exact');
    setAllocationValues(Object.fromEntries(expense.shares.map(({ userId, amountMinor }) => [userId, amountInputFromMinor(amountMinor, expense.currency)])));
    setReceipt(undefined);
    setAiNotice(undefined);
    setFormError(undefined);
    setSuccess(undefined);
    setExpandedExpenseId(undefined);
  }

  function toggleParticipant(userId: string) {
    if (!activeTrip) return;
    setParticipantsByTrip((current) => ({
      ...current,
      [activeTrip.id]: participantIds.includes(userId)
        ? participantIds.filter((id) => id !== userId)
        : [...participantIds, userId],
    }));
  }

  function togglePayer(userId: string) {
    const current = selectedPayerIds;
    if (current.includes(userId)) {
      if (current.length === 1) return;
      const next = current.filter((id) => id !== userId);
      setPayerIds(next);
      setPayerOverride(next[0]);
      return;
    }
    setPayerIds([...current, userId]);
    setPayerAmounts((values) => ({ ...values, [userId]: values[userId] ?? '' }));
  }

  function changeSplitMode(mode: 'equal' | 'exact' | 'percentage' | 'shares') {
    setSplitMode(mode);
    if (mode === 'equal') {
      setAllocationValues({});
      return;
    }
    setAllocationValues((current) => Object.fromEntries(participantIds.map((participantId, index) => [participantId, current[participantId] ?? defaultAllocationValueFor(mode, index, participantIds.length)])));
  }

  async function pickReceipt(source: 'camera' | 'library', expenseId?: string) {
    setFormError(undefined);
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setFormError(tx('需要相机权限才能拍摄小票。你仍可从相册选择。', 'Camera permission is required to photograph a receipt. You can still choose one from the library.'));
          return;
        }
      }
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
      if (result.canceled) return;
      const asset = result.assets[0];
      const context = ImageManipulator.manipulate(asset.uri);
      if (asset.width > 2000) context.resize({ width: 2000, height: null });
      const rendered = await context.renderAsync();
      const normalized = await rendered.saveAsync({
        format: SaveFormat.JPEG,
        compress: 0.75,
        base64: true,
      });
      const nextReceipt: ReceiptDraft = {
        uri: normalized.uri,
        base64: normalized.base64,
        mimeType: 'image/jpeg',
      };
      const estimatedSize = normalized.base64 ? Math.ceil(normalized.base64.length * 0.75) : 0;
      if (estimatedSize > 10 * 1024 * 1024) {
        setFormError(tx('小票图片不能超过 10 MB。', 'Receipt images must be 10 MB or smaller.'));
        return;
      }
      if (!expenseId) {
        setReceipt(nextReceipt);
        return;
      }
      setBusyAction('receipt');
      await attachExpenseReceipt(expenseId, nextReceipt);
      setSuccess(tx('小票已添加到这笔支出。', 'Receipt added to this expense.'));
      setExpandedExpenseId(expenseId);
    } catch (caught) {
      setFormError(toUserMessage(caught, tx('无法添加小票，请稍后重试。', 'Could not add the receipt. Please try again.')));
    } finally {
      setBusyAction(undefined);
    }
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
        memberIds,
      });
      applyAiDraft(draft);
    } catch (caught) {
      setFormError(toUserMessage(caught, tx('AI 解析失败，请换一种说法或手动填写。', 'AI could not parse that. Rephrase it or enter the details manually.')));
    } finally {
      setBusyAction(undefined);
    }
  }

  function applyAiDraft(draft: AiExpenseDraft) {
    if (!activeTrip) return;
    setTitle(draft.title);
    setAmount(draft.amount);
    setCurrencyOverride(draft.currency);
    setPayerOverride(draft.payerUserId);
    setPayerIds([draft.payerUserId]);
    setPayerAmounts({});
    setSplitMode('equal');
    setAllocationValues({});
    setParticipantsByTrip((current) => ({ ...current, [activeTrip.id]: draft.participantUserIds }));
    setEntryMode('manual');
    const confidence = Math.round(draft.confidence * 100);
    setAiNotice([
      tx(`AI 已生成草稿（置信度 ${confidence}%），请核对后再保存。`, `AI created a draft (${confidence}% confidence). Review it before saving.`),
      ...draft.warnings,
    ].join(' '));
  }

  async function parseVoiceExpense(audioBase64: string, audioMimeType: string) {
    if (!activeTrip) return;
    setBusyAction('parse');
    setFormError(undefined);
    setSuccess(undefined);
    setAiNotice(undefined);
    try {
      applyAiDraft(await parseExpenseAudio({ tripId: activeTrip.id, audioBase64, audioMimeType, memberIds }));
    } catch (caught) {
      setFormError(toUserMessage(caught, tx('AI 无法识别这段语音，请重试或手动填写。', 'AI could not understand the recording. Try again or enter it manually.')));
    } finally {
      setBusyAction(undefined);
    }
  }

  async function submitExpense() {
    let totalMinor: number;
    let rate: number;
    let baseAmountMinor: number;
    let payerAllocations: { participantId: string; amountMinor: number }[];
    try {
      totalMinor = parseAmountToMinor(amount, currency);
      rate = currency.toUpperCase() === baseCurrency.toUpperCase() ? 1 : parseExchangeRate(exchangeRate);
      baseAmountMinor = convertMinorAmount(totalMinor, currency, baseCurrency, rate);
      if (allocationPreview.length !== participantIds.length) throw new Error(tx('请完成分摊设置，并确保总额一致。', 'Complete the split and make sure it adds up to the total.'));
      payerAllocations = selectedPayerIds.length === 1
        ? [{ participantId: selectedPayerIds[0], amountMinor: totalMinor }]
        : selectedPayerIds.map((participantId) => ({ participantId, amountMinor: parseAmountToMinor(payerAmounts[participantId] ?? '', currency) }));
      assertAllocationsTotal(totalMinor, payerAllocations, tx('付款金额', 'Payer amounts'));
    } catch (caught) {
      setFormError(toUserMessage(caught, tx('请检查金额、汇率和分摊设置。', 'Check the amount, rate, and split.')));
      return;
    }
    setBusyAction('save');
    setFormError(undefined);
    setSuccess(undefined);
    try {
      const payerAllocationsInput = payerAllocations.map(({ participantId, amountMinor }) => ({ userId: participantId, amountMinor }));
      const shareAllocationsInput = allocationPreview.map(({ participantId, amountMinor }) => ({ userId: participantId, amountMinor }));
      const result = editingExpenseId
        ? await updateCustomExpense({
          expenseId: editingExpenseId,
          title,
          currency: currency.toUpperCase(),
          totalMinor,
          baseCurrency: baseCurrency.toUpperCase(),
          baseAmountMinor,
          exchangeRate: rate,
          exchangeRateSource: 'manual',
          payerAllocations: payerAllocationsInput,
          shareAllocations: shareAllocationsInput,
        })
        : await addCustomExpense({
          title,
          currency: currency.toUpperCase(),
          totalMinor,
          baseCurrency: baseCurrency.toUpperCase(),
          baseAmountMinor,
          exchangeRate: rate,
          exchangeRateSource: 'manual',
          payerAllocations: payerAllocationsInput,
          shareAllocations: shareAllocationsInput,
          source: aiNotice ? 'text' : 'manual',
          clientMutationId: `${activeTrip?.id ?? 'trip'}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`,
          receipt,
        });
      if (editingExpenseId && receipt) {
        try {
          await attachExpenseReceipt(editingExpenseId, receipt);
        } catch {
          setSuccess(tx('支出已更新，但小票上传失败；可在支出详情中重新添加。', 'Expense updated, but the receipt upload failed. Add it again from the expense details.'));
        }
      }
      setTitle('');
      setAmount('');
      setExchangeRate('1');
      setAiText('');
      setReceipt(undefined);
      setPayerIds([]);
      setPayerAmounts({});
      setAllocationValues({});
      setSplitMode('equal');
      setAiNotice(undefined);
      setEditingExpenseId(undefined);
      setComposerOpen(false);
      setActiveView('activity');
      if (!editingExpenseId || !receipt) {
        setSuccess('receiptError' in result && result.receiptError
          ? tx('支出已保存，但小票上传失败；可在支出详情中重新添加。', 'Expense saved, but the receipt upload failed. Add it again from the expense details.')
          : editingExpenseId
            ? tx('支出已更新，分摊和结算待办已更新。', 'Expense updated. Shares and settlement tasks are updated.')
            : tx('支出已保存，分摊和结算待办已更新。', 'Expense saved. Shares and settlement tasks are updated.'));
      }
    } catch (caught) {
      setFormError(toUserMessage(caught, tx('无法保存支出，请稍后重试。', 'Could not save the expense. Please try again.')));
    } finally {
      setBusyAction(undefined);
    }
  }

  async function completeTransfer(transfer: SettlementTransfer & { currency: string }) {
    const transferKey = `${transfer.currency}-${transfer.fromParticipantId}-${transfer.toParticipantId}`;
    const draft = settlementDrafts[transferKey] ?? { currency: baseCurrency, amount: amountInputFromMinor(transfer.amountMinor, baseCurrency), rate: '1' };
    setBusySettlementId(transferKey);
    setFormError(undefined);
    setSuccess(undefined);
    try {
      const amountMinor = parseAmountToMinor(draft.amount, draft.currency);
      const exchangeRate = draft.currency.toUpperCase() === baseCurrency.toUpperCase() ? 1 : parseExchangeRate(draft.rate);
      const baseAmountMinor = convertMinorAmount(amountMinor, draft.currency, baseCurrency, exchangeRate);
      if (baseAmountMinor > transfer.amountMinor) throw new Error(tx('折算金额不能超过待转余额。', 'The converted amount cannot exceed the amount due.'));
      await markSettlement({
        toUserId: transfer.toParticipantId,
        currency: draft.currency,
        amountMinor,
        baseCurrency,
        baseAmountMinor,
        exchangeRate,
        exchangeRateSource: 'manual',
      });
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setSettlementDrafts((current) => {
        const next = { ...current };
        delete next[transferKey];
        return next;
      });
      setExpandedSettlementKey(undefined);
      setSuccess(tx('已标记为已转账，收款方的“已收入”会同步更新。', 'Marked as sent. The recipient’s received total is updated automatically.'));
    } catch (caught) {
      setFormError(toUserMessage(caught, tx('无法更新转账状态，请刷新后重试。', 'Could not update the transfer. Refresh and try again.')));
    } finally {
      setBusySettlementId(undefined);
    }
  }

  async function undoTransfer(settlement: Settlement) {
    setBusySettlementId(settlement.id);
    setFormError(undefined);
    setSuccess(undefined);
    try {
      await unmarkSettlement(settlement.id);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setSuccess(tx('已恢复为未转账。', 'Marked as not sent again.'));
    } catch (caught) {
      setFormError(toUserMessage(caught, tx('无法撤销转账状态，请稍后重试。', 'Could not undo the transfer status. Please try again.')));
    } finally {
      setBusySettlementId(undefined);
    }
  }

  return (
    <Screen
      scrollToKey={composerOpen ? 'expense-composer' : undefined}
      scrollToOffset={composerOffset}
      title={activeTrip ? tx(`${activeTrip.name} · 账本`, `${activeTrip.name} · ledger`) : tx('共享账本', 'Shared ledger')}
      subtitle={tx('结算 · 明细', 'Settle · activity')}
      floatingAction={activeTrip ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={composerOpen ? tx('关闭记账', 'Close expense entry') : tx('记一笔', 'Add expense')}
          accessibilityState={{ expanded: composerOpen }}
          onPress={toggleComposer}
          style={({ pressed }) => [styles.floatingAdd, pressed && styles.pressed]}>
          <View style={styles.plusIcon}>
            <View style={styles.plusHorizontal} />
            <View style={styles.plusVertical} />
          </View>
        </Pressable>
      ) : null}>
      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
      {formError ? <InlineNotice tone="error">{formError}</InlineNotice> : null}
      {success ? <InlineNotice>{success}</InlineNotice> : null}

      {activeTrip ? (
        <View style={[styles.toolbar, compact && styles.toolbarCompact]}>
          <View style={[styles.viewSwitch, compact && styles.viewSwitchCompact, { backgroundColor: theme.backgroundSelected }]}>
            <ViewSwitchButton selected={activeView === 'settle'} onPress={() => setActiveView('settle')}>
              {tx('结算', 'Settle')}
            </ViewSwitchButton>
            <ViewSwitchButton selected={activeView === 'activity'} onPress={() => setActiveView('activity')}>
              {tx('明细', 'Activity')}
            </ViewSwitchButton>
          </View>
        </View>
      ) : null}

      {activeTrip && composerOpen ? (
        <View onLayout={({ nativeEvent }) => setComposerOffset(nativeEvent.layout.y)}>
          <ExpenseComposer
          themeSurface={theme.backgroundElement}
          themeSelected={theme.backgroundSelected}
          dangerColor={dangerColor}
          tx={tx}
          editing={Boolean(editingExpenseId)}
          entryMode={entryMode}
          chooseEntryMode={chooseEntryMode}
          aiText={aiText}
          setAiText={setAiText}
          parseWithAi={parseWithAi}
          parseVoiceExpense={parseVoiceExpense}
          busyAction={busyAction}
          aiNotice={aiNotice}
          title={title}
          setTitle={setTitle}
          amount={amount}
          setAmount={setAmount}
          currency={currency}
          baseCurrency={baseCurrency}
          exchangeRate={exchangeRate}
          currencyOptions={currencyOptions}
          setCurrencyOverride={chooseCurrency}
          setExchangeRate={setExchangeRate}
          members={members}
          selectedPayerIds={selectedPayerIds}
          payerAmounts={payerAmounts}
          setPayerAmount={(userId, value) => setPayerAmounts((current) => ({ ...current, [userId]: value }))}
          togglePayer={togglePayer}
          participantIds={participantIds}
          toggleParticipant={toggleParticipant}
          splitMode={splitMode}
          changeSplitMode={changeSplitMode}
          allocationValues={allocationValues}
          setAllocationValue={(userId, value) => setAllocationValues((current) => ({ ...current, [userId]: value }))}
          allocationPreview={allocationPreview}
          names={names}
          receipt={receipt}
          setReceipt={setReceipt}
          pickReceipt={pickReceipt}
          closeComposer={closeComposer}
            submitExpense={submitExpense}
          />
        </View>
      ) : null}

      {!activeTrip ? (
        <InlineNotice>{tx('请先创建或加入一个行程，再开始记账。', 'Create or join a trip before using the ledger.')}</InlineNotice>
      ) : activeView === 'settle' ? (
        <SettlementWorkspace
          tx={tx}
          names={names}
          memberById={memberById}
          currentUserId={currentUserId}
          balanceSnapshots={balanceSnapshots}
          settlements={settlements}
          myPendingTransfers={myPendingTransfers}
          myIncomingTransfers={myIncomingTransfers}
          pendingTransfers={pendingTransfers}
          baseCurrency={baseCurrency}
          currencyOptions={currencyOptions}
          settlementDrafts={settlementDrafts}
          expandedSettlementKey={expandedSettlementKey}
          setSettlementDrafts={setSettlementDrafts}
          setExpandedSettlementKey={setExpandedSettlementKey}
          busySettlementId={busySettlementId}
          compact={compact}
          showGroupSettlement={showGroupSettlement}
          toggleGroupSettlement={() => setShowGroupSettlement((current) => !current)}
          themeSelected={theme.backgroundSelected}
          positiveColor={positiveColor}
          dangerColor={dangerColor}
          linkColor={linkColor}
          completeTransfer={completeTransfer}
          undoTransfer={undoTransfer}
        />
      ) : (
        <ExpenseActivity
          tx={tx}
          expenses={expenses}
          names={names}
          memberById={memberById}
          formatDateTime={formatDateTime}
          expandedExpenseId={expandedExpenseId}
          setExpandedExpenseId={setExpandedExpenseId}
          onEditExpense={startEditingExpense}
          canEditExpense={(expense) => Boolean(currentMember && ['owner', 'editor'].includes(currentMember.role)) || expense.createdBy === currentUserId || expense.payers.some(({ userId }) => userId === currentUserId)}
          settlementStatusByUser={settlementStatusByUser}
          pickReceipt={pickReceipt}
          receiptBusy={busyAction === 'receipt'}
          themeSelected={theme.backgroundSelected}
          positiveColor={positiveColor}
        />
      )}
    </Screen>
  );
}

function ViewSwitchButton({ selected, onPress, children }: { selected: boolean; onPress: () => void; children: string }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.viewSwitchButton, selected && styles.viewSwitchButtonActive, pressed && styles.pressed]}>
      <ThemedText type="smallBold" style={selected ? styles.viewSwitchTextActive : undefined}>{children}</ThemedText>
    </Pressable>
  );
}

function ExpenseComposer(props: {
  themeSurface: string;
  themeSelected: string;
  dangerColor: string;
  tx: (zh: string, en: string) => string;
  editing: boolean;
  entryMode: 'manual' | 'ai';
  chooseEntryMode: (mode: 'manual' | 'ai') => void;
  aiText: string;
  setAiText: (value: string) => void;
  parseWithAi: () => Promise<void>;
  parseVoiceExpense: (audioBase64: string, audioMimeType: string) => Promise<void>;
  busyAction?: 'parse' | 'save' | 'receipt';
  aiNotice?: string;
  title: string;
  setTitle: (value: string) => void;
  amount: string;
  setAmount: (value: string) => void;
  currency: string;
  baseCurrency: string;
  exchangeRate: string;
  currencyOptions: { label: string; value: string }[];
  setCurrencyOverride: (value: string) => void;
  setExchangeRate: (value: string) => void;
  members: TripMember[];
  selectedPayerIds: string[];
  payerAmounts: Record<string, string>;
  setPayerAmount: (userId: string, value: string) => void;
  togglePayer: (userId: string) => void;
  participantIds: string[];
  toggleParticipant: (userId: string) => void;
  splitMode: 'equal' | 'exact' | 'percentage' | 'shares';
  changeSplitMode: (mode: 'equal' | 'exact' | 'percentage' | 'shares') => void;
  allocationValues: Record<string, string>;
  setAllocationValue: (userId: string, value: string) => void;
  allocationPreview: { participantId: string; amountMinor: number }[];
  names: Map<string, string>;
  receipt?: ReceiptDraft;
  setReceipt: (receipt?: ReceiptDraft) => void;
  pickReceipt: (source: 'camera' | 'library') => Promise<void>;
  closeComposer: () => void;
  submitExpense: () => Promise<void>;
}) {
  const { tx } = props;
  const { width } = useWindowDimensions();
  const compact = width < 520;
  return (
    <View style={[styles.composer, compact && styles.composerCompact, { backgroundColor: props.themeSurface }]}>
      <View style={styles.composerHeading}>
        <View style={styles.composerTitleRow}>
          <SectionHeading title={props.editing ? tx('编辑支出', 'Edit expense') : tx('记一笔', 'Add expense')} />
          <Pressable accessibilityRole="button" accessibilityLabel={tx('取消编辑', 'Cancel')} onPress={props.closeComposer} style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
            <ThemedText type="smallBold">{tx('取消', 'Cancel')}</ThemedText>
          </Pressable>
        </View>
        <View style={styles.modeRow}>
          <ChoiceChip selected={props.entryMode === 'manual'} onPress={() => props.chooseEntryMode('manual')}>
            {tx('手动', 'Manual')}
          </ChoiceChip>
          <ChoiceChip selected={props.entryMode === 'ai'} onPress={() => props.chooseEntryMode('ai')}>
            {tx('AI 一句话', 'AI sentence')}
          </ChoiceChip>
        </View>
      </View>

      {props.entryMode === 'ai' ? (
        <View style={styles.formGroup}>
          <FormField
            label={tx('描述这笔支出', 'Describe the expense')}
            value={props.aiText}
            onChangeText={props.setAiText}
            placeholder={tx('晚餐 860 港币，小王付款，三人均分', 'Dinner 860 HKD, paid by Sam, split three ways')}
            multiline
            numberOfLines={3}
            maxLength={500}
            style={styles.multiline}
          />
          <ActionButton busy={props.busyAction === 'parse'} disabled={!props.aiText.trim() || Boolean(props.busyAction)} onPress={() => void props.parseWithAi()}>
            {tx('生成草稿', 'Create draft')}
          </ActionButton>
          <VoiceExpenseInput disabled={Boolean(props.busyAction)} tx={tx} onAudioReady={props.parseVoiceExpense} />
        </View>
      ) : (
        <View style={styles.formGroup}>
          {props.aiNotice ? <InlineNotice>{props.aiNotice}</InlineNotice> : null}
          <FormField label={tx('支出内容', 'Expense')} value={props.title} onChangeText={props.setTitle} placeholder={tx('例如：晚餐', 'For example: Dinner')} />
          <View style={[styles.amountRow, compact && styles.amountRowCompact]}>
            <View style={styles.grow}>
              <FormField label={tx('金额', 'Amount')} value={props.amount} onChangeText={props.setAmount} keyboardType="decimal-pad" placeholder="860.00" />
            </View>
            <View style={[styles.currencyField, compact && styles.currencyFieldCompact]}>
              <SelectionField label={tx('币种', 'Currency')} value={props.currency} options={props.currencyOptions} onChange={props.setCurrencyOverride} />
            </View>
          </View>
          {props.currency.toUpperCase() !== props.baseCurrency.toUpperCase() ? (
            <View style={[styles.conversionRow, { backgroundColor: props.themeSelected }]}>
              <View style={styles.grow}>
                <FormField
                  label={tx(`汇率：1 ${props.currency} = ? ${props.baseCurrency}`, `Rate: 1 ${props.currency} = ? ${props.baseCurrency}`)}
                  value={props.exchangeRate}
                  onChangeText={props.setExchangeRate}
                  keyboardType="decimal-pad"
                  placeholder="0.92"
                />
              </View>
              <View style={styles.conversionPreview}>
                <ThemedText type="smallBold">{tx('记入本位币', 'Bookkeeping amount')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {(() => {
                    try {
                      if (!props.amount.trim() || !props.exchangeRate.trim()) return '—';
                      return formatMinorAmount(convertMinorAmount(parseAmountToMinor(props.amount, props.currency), props.currency, props.baseCurrency, parseExchangeRate(props.exchangeRate)), props.baseCurrency);
                    } catch {
                      return '—';
                    }
                  })()}
                </ThemedText>
              </View>
            </View>
          ) : null}
          <FieldGroup label={tx('谁付款？可多选', 'Who paid? You can choose more than one')}>
            {props.members.map((member) => (
              <MemberChoice key={member.userId} member={member} selected={props.selectedPayerIds.includes(member.userId)} onPress={() => props.togglePayer(member.userId)} />
            ))}
          </FieldGroup>
          {props.selectedPayerIds.length > 1 ? (
          <View style={[styles.splitFields, { backgroundColor: props.themeSelected }]}>
              <ThemedText type="small" themeColor="textSecondary">{tx('填写每位付款人的实际金额，总和必须等于支出总额。', 'Enter what each payer actually paid; the total must match the expense.')}</ThemedText>
              {props.selectedPayerIds.map((userId) => (
                <FormField
                  key={userId}
                  label={tx(`${props.names.get(userId) ?? '同行者'} 付款金额`, `${props.names.get(userId) ?? 'Traveller'} paid`)}
                  value={props.payerAmounts[userId] ?? ''}
                  onChangeText={(value) => props.setPayerAmount(userId, value)}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                />
              ))}
            </View>
          ) : null}
          <FieldGroup label={tx('谁参与分摊？', 'Who shares it?')}>
            {props.members.map((member) => (
              <MemberChoice key={member.userId} member={member} selected={props.participantIds.includes(member.userId)} onPress={() => props.toggleParticipant(member.userId)} />
            ))}
          </FieldGroup>
          <FieldGroup label={tx('怎么分？', 'How should it split?')}>
            {([
              ['equal', tx('均分', 'Equal')],
              ['exact', tx('指定金额', 'Exact')],
              ['percentage', tx('按比例', 'Percent')],
              ['shares', tx('按份数', 'Shares')],
            ] as const).map(([mode, label]) => (
              <ChoiceChip role="radio" key={mode} selected={props.splitMode === mode} onPress={() => props.changeSplitMode(mode)}>{label}</ChoiceChip>
            ))}
          </FieldGroup>
          {props.splitMode !== 'equal' ? (
            <View style={[styles.splitFields, { backgroundColor: props.themeSelected }]}>
              <ThemedText type="small" themeColor="textSecondary">
                {props.splitMode === 'exact' ? tx('输入每人的金额。', 'Enter an amount for each person.') : props.splitMode === 'percentage' ? tx('输入百分比，总和必须为 100。', 'Enter percentages that add up to 100.') : tx('输入每人的份数，例如 1、2、3。', 'Enter weights such as 1, 2, 3.')}
              </ThemedText>
              {props.participantIds.map((userId, index) => (
                <FormField
                  key={userId}
                  label={tx(`${props.names.get(userId) ?? '同行者'} 的${props.splitMode === 'exact' ? '金额' : props.splitMode === 'percentage' ? '比例' : '份数'}`, `${props.names.get(userId) ?? 'Traveller'} ${props.splitMode === 'exact' ? 'amount' : props.splitMode === 'percentage' ? 'percent' : 'shares'}`)}
                  value={props.allocationValues[userId] ?? defaultAllocationValueFor(props.splitMode, index, props.participantIds.length)}
                  onChangeText={(value) => props.setAllocationValue(userId, value)}
                  keyboardType="decimal-pad"
                  placeholder={props.splitMode === 'exact' ? '0.00' : props.splitMode === 'percentage' ? '50' : '1'}
                />
              ))}
            </View>
          ) : null}
          {props.allocationPreview.length > 0 ? (
            <View style={[styles.splitPreview, { backgroundColor: props.themeSelected }]}>
              <ThemedText type="smallBold">{tx('分摊预览', 'Split preview')}</ThemedText>
              {props.allocationPreview.map(({ participantId, amountMinor }) => (
                <ThemedText key={participantId} type="small" themeColor="textSecondary">
                  {props.names.get(participantId) ?? tx('同行者', 'Traveller')} · {formatMinorAmount(amountMinor, props.currency)}
                </ThemedText>
              ))}
            </View>
          ) : null}
            <View style={styles.receiptGroup}>
              <View style={styles.receiptCopy}>
                <ThemedText type="smallBold">{tx('小票（可选）', 'Receipt (optional)')}</ThemedText>
            </View>
            {props.receipt ? (
              <View style={styles.receiptPreviewRow}>
                <Image accessible accessibilityLabel={tx('待上传的小票预览', 'Receipt preview awaiting upload')} source={props.receipt.uri} style={styles.receiptPreview} contentFit="contain" />
                <Pressable accessibilityRole="button" onPress={() => props.setReceipt(undefined)} style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
                  <ThemedText type="smallBold" style={{ color: props.dangerColor }}>{tx('移除', 'Remove')}</ThemedText>
                </Pressable>
              </View>
            ) : (
              <View style={styles.receiptActions}>
                <Pressable accessibilityRole="button" onPress={() => void props.pickReceipt('camera')} style={({ pressed }) => [styles.secondaryAction, { backgroundColor: props.themeSelected }, pressed && styles.pressed]}>
                  <ThemedText type="smallBold">{tx('拍摄小票', 'Take photo')}</ThemedText>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => void props.pickReceipt('library')} style={({ pressed }) => [styles.secondaryAction, { backgroundColor: props.themeSelected }, pressed && styles.pressed]}>
                  <ThemedText type="smallBold">{tx('从相册选择', 'Choose photo')}</ThemedText>
                </Pressable>
              </View>
            )}
          </View>
          <ActionButton
            busy={props.busyAction === 'save'}
            disabled={Boolean(props.busyAction) || !props.title.trim() || !props.amount.trim() || props.participantIds.length === 0 || props.selectedPayerIds.length === 0 || (props.currency.toUpperCase() !== props.baseCurrency.toUpperCase() && !props.exchangeRate.trim())}
            onPress={() => void props.submitExpense()}>
            {props.editing ? tx('保存修改', 'Save changes') : tx('保存支出', 'Save expense')}
          </ActionButton>
        </View>
      )}
    </View>
  );
}

async function uriToBase64(uri: string) {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Could not read recording'));
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.readAsDataURL(blob);
  });
}

function VoiceExpenseInput(props: {
  disabled: boolean;
  tx: (zh: string, en: string) => string;
  onAudioReady: (audioBase64: string, audioMimeType: string) => Promise<void>;
}) {
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const state = useAudioRecorderState(recorder);
  const [voiceError, setVoiceError] = useState<string>();
  const [processing, setProcessing] = useState(false);

  async function startRecording() {
    setVoiceError(undefined);
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setVoiceError(props.tx('需要麦克风权限才能语音记账。', 'Microphone permission is required for voice expenses.'));
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  }

  async function stopAndParse() {
    setProcessing(true);
    setVoiceError(undefined);
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      if (!recorder.uri) throw new Error('Recording is unavailable');
      const audioBase64 = await uriToBase64(recorder.uri);
      const audioMimeType = Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4';
      await props.onAudioReady(audioBase64, audioMimeType);
    } catch {
      setVoiceError(props.tx('无法处理录音，请重试或改用文字。', 'Could not process the recording. Try again or use text.'));
    } finally {
      setProcessing(false);
    }
  }

  return (
    <View style={styles.voiceGroup}>
      <View style={styles.voiceControlRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={processing
            ? props.tx('正在解析语音', 'Processing voice')
            : state.isRecording
              ? props.tx('结束语音记账', 'Finish voice expense')
              : props.tx('开始语音记账', 'Start voice expense')}
          accessibilityState={{ disabled: props.disabled || processing, busy: processing }}
          disabled={props.disabled || processing}
          onPress={() => void (state.isRecording ? stopAndParse() : startRecording())}
          style={({ pressed }) => [styles.voiceButton, state.isRecording && styles.voiceButtonRecording, pressed && styles.pressed, (props.disabled || processing) && styles.disabled]}>
          <MicrophoneGlyph active={state.isRecording || processing} />
        </Pressable>
        {processing ? <ThemedText type="small" themeColor="textSecondary">{props.tx('解析中…', 'Processing…')}</ThemedText> : state.isRecording ? <ThemedText type="smallBold">{Math.round(state.durationMillis / 1000)}s</ThemedText> : null}
      </View>
      {voiceError ? <InlineNotice tone="error">{voiceError}</InlineNotice> : null}
    </View>
  );
}

function MicrophoneGlyph({ active }: { active: boolean }) {
  return (
    <View style={styles.micGlyph} accessibilityElementsHidden>
      <View style={[styles.micBody, active && styles.micBodyActive]} />
      <View style={[styles.micArc, active && styles.micArcActive]} />
      <View style={[styles.micStem, active && styles.micStemActive]} />
      <View style={[styles.micBase, active && styles.micBaseActive]} />
    </View>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.fieldGroup}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

function MemberChoice({ member, selected, role = 'checkbox', onPress }: { member: TripMember; selected: boolean; role?: 'radio' | 'checkbox'; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{ checked: selected }}
      accessibilityLabel={member.displayName}
      onPress={onPress}
      style={({ pressed }) => [styles.memberChoice, { backgroundColor: selected ? '#087F6A' : theme.backgroundSelected }, pressed && styles.pressed]}>
      <MemberAvatar avatarUrl={member.avatarUrl} displayName={member.displayName} size={30} />
      <ThemedText type="smallBold" style={selected ? styles.memberChoiceTextSelected : undefined}>{member.displayName}</ThemedText>
    </Pressable>
  );
}

function SettlementPaymentEditor(props: {
  tx: (zh: string, en: string) => string;
  baseCurrency: string;
  currencyOptions: { label: string; value: string }[];
  transfer: SettlementTransfer & { currency: string };
  draft: SettlementDraft;
  setDraft: (draft: SettlementDraft) => void;
}) {
  const { tx } = props;
  const { width } = useWindowDimensions();
  const compact = width < 520;
  const sameCurrency = props.draft.currency.toUpperCase() === props.baseCurrency.toUpperCase();
  return (
    <View style={[styles.paymentEditor, compact && styles.paymentEditorCompact]}>
      <View style={[styles.paymentEditorFields, compact && styles.paymentEditorFieldsCompact]}>
        <View style={[styles.paymentCurrencyField, compact && styles.paymentCurrencyFieldCompact]}>
          <SelectionField
            label={tx('付款币种', 'Payment currency')}
            value={props.draft.currency}
            options={props.currencyOptions}
            onChange={(currency) => props.setDraft({ ...props.draft, currency, amount: '', rate: currency === props.baseCurrency ? '1' : props.draft.rate })}
          />
        </View>
        <View style={styles.grow}>
          <FormField
            label={tx('实际转账金额', 'Amount sent')}
            value={props.draft.amount}
            onChangeText={(amount) => props.setDraft({ ...props.draft, amount })}
            keyboardType="decimal-pad"
            placeholder="0.00"
          />
        </View>
      </View>
      {!sameCurrency ? (
        <FormField
          label={tx(`汇率：1 ${props.draft.currency} = ? ${props.baseCurrency}`, `Rate: 1 ${props.draft.currency} = ? ${props.baseCurrency}`)}
          value={props.draft.rate}
          onChangeText={(rate) => props.setDraft({ ...props.draft, rate })}
          keyboardType="decimal-pad"
          placeholder="0.92"
        />
      ) : null}
      <ThemedText type="small" themeColor="textSecondary">
        {(() => {
          try {
            if (!props.draft.amount.trim()) return tx('会从待转余额中扣除实际折算金额。', 'The converted amount will be deducted from the balance due.');
            const rate = sameCurrency ? 1 : parseExchangeRate(props.draft.rate);
            const converted = convertMinorAmount(parseAmountToMinor(props.draft.amount, props.draft.currency), props.draft.currency, props.baseCurrency, rate);
            return tx(`记入 ${props.baseCurrency}：${formatMinorAmount(converted, props.baseCurrency)} · 待转 ${formatMinorAmount(props.transfer.amountMinor, props.baseCurrency)}`, `Books ${formatMinorAmount(converted, props.baseCurrency)} in ${props.baseCurrency} · due ${formatMinorAmount(props.transfer.amountMinor, props.baseCurrency)}`);
          } catch {
            return tx('请输入金额和有效汇率。', 'Enter an amount and a valid rate.');
          }
        })()}
      </ThemedText>
    </View>
  );
}

function SettlementWorkspace(props: {
  tx: (zh: string, en: string) => string;
  names: Map<string, string>;
  memberById: Map<string, TripMember>;
  currentUserId: string;
  balanceSnapshots: BalanceSnapshot[];
  settlements: Settlement[];
  myPendingTransfers: (SettlementTransfer & { currency: string })[];
  myIncomingTransfers: (SettlementTransfer & { currency: string })[];
  pendingTransfers: (SettlementTransfer & { currency: string })[];
  baseCurrency: string;
  currencyOptions: { label: string; value: string }[];
  settlementDrafts: Record<string, SettlementDraft>;
  expandedSettlementKey?: string;
  setSettlementDrafts: React.Dispatch<React.SetStateAction<Record<string, SettlementDraft>>>;
  setExpandedSettlementKey: (key?: string) => void;
  busySettlementId?: string;
  compact: boolean;
  showGroupSettlement: boolean;
  toggleGroupSettlement: () => void;
  themeSelected: string;
  positiveColor: string;
  dangerColor: string;
  linkColor: string;
  completeTransfer: (transfer: SettlementTransfer & { currency: string }) => Promise<void>;
  undoTransfer: (settlement: Settlement) => Promise<void>;
}) {
  const { tx } = props;
  const [showCompleted, setShowCompleted] = useState(false);
  const mySettlements = props.settlements.filter((settlement) =>
    settlement.fromUserId === props.currentUserId || settlement.toUserId === props.currentUserId,
  );

  return (
    <View style={styles.workspace}>
      <View style={styles.personalSummary}>
        <SectionHeading
          title={tx('我的结算', 'My settlements')}
          detail={props.myPendingTransfers.length > 0
            ? tx(`还有 ${props.myPendingTransfers.length} 笔待转`, `${props.myPendingTransfers.length} payment${props.myPendingTransfers.length === 1 ? '' : 's'} to send`)
            : tx('没有待转款项', 'Nothing left to send')}
        />
        {props.balanceSnapshots.length === 0 ? (
          <ThemedText themeColor="textSecondary">{tx('记录第一笔共同支出后，这里会生成结算待办。', 'Add the first shared expense to create settlement tasks.')}</ThemedText>
        ) : props.balanceSnapshots.map((snapshot) => {
          const pendingOut = sumTransfers(snapshot.outstandingTransfers, 'from', props.currentUserId);
          const pendingIn = sumTransfers(snapshot.outstandingTransfers, 'to', props.currentUserId);
          const sent = sumSettlements(props.settlements, snapshot.currency, 'from', props.currentUserId);
          const received = sumSettlements(props.settlements, snapshot.currency, 'to', props.currentUserId);
          return (
            <View key={snapshot.currency} style={[styles.personalCurrencyRow, props.compact && styles.personalCurrencyRowCompact]}>
              <View style={styles.currencyIdentity}>
                <ThemedText type="smallBold" style={[styles.currencyCode, { color: props.positiveColor }]}>{snapshot.currency}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{snapshot.currency.toUpperCase() === props.baseCurrency.toUpperCase() ? tx('行程本位币', 'Trip base') : tx('实际支付币种', 'Payment currency')}</ThemedText>
              </View>
              <Metric label={tx('待转出', 'To send')} value={formatMinorAmount(pendingOut, snapshot.currency)} color={props.dangerColor} />
              <Metric label={tx('已转出', 'Sent')} value={formatMinorAmount(sent, snapshot.currency)} />
              <Metric label={tx('待收款', 'To receive')} value={formatMinorAmount(pendingIn, snapshot.currency)} />
              <Metric label={tx('已收款', 'Received')} value={formatMinorAmount(received, snapshot.currency)} color={props.positiveColor} />
            </View>
          );
        })}
      </View>

      <View style={styles.sectionBlock}>
        <SectionHeading title={tx('我的待办', 'My tasks')} detail={tx('结算页的金额按币种汇总；明细页可编辑每笔支出。', 'Balances are grouped by currency; edit any expense from Activity.')} />
        {props.myPendingTransfers.length === 0 ? (
          <View style={styles.quietEmpty}>
            <ThemedText type="smallBold">{tx('待转出已清空', 'Nothing to send')}</ThemedText>
            {props.myIncomingTransfers.length > 0 ? (
              <ThemedText type="small" themeColor="textSecondary">{tx(`仍有 ${props.myIncomingTransfers.length} 笔款项待他人转给你。`, `${props.myIncomingTransfers.length} incoming payment${props.myIncomingTransfers.length === 1 ? '' : 's'} still pending.`)}</ThemedText>
            ) : null}
          </View>
        ) : props.myPendingTransfers.map((transfer) => {
          const key = `${transfer.currency}-${transfer.fromParticipantId}-${transfer.toParticipantId}`;
          const recipient = props.memberById.get(transfer.toParticipantId);
          const draft = props.settlementDrafts[key] ?? { currency: props.baseCurrency, amount: amountInputFromMinor(transfer.amountMinor, props.baseCurrency), rate: '1' };
          const expanded = props.expandedSettlementKey === key;
          return (
            <View key={key} style={[styles.transferRow, props.compact && styles.transferRowCompact]}>
              <MemberAvatar avatarUrl={recipient?.avatarUrl} displayName={recipient?.displayName ?? tx('同行者', 'Traveller')} size={42} />
              <View style={styles.transferCopy}>
                <ThemedText type="smallBold">{tx(`转给 ${props.names.get(transfer.toParticipantId) ?? '同行者'}`, `Pay ${props.names.get(transfer.toParticipantId) ?? 'Traveller'}`)}</ThemedText>
                <ThemedText style={styles.transferAmount}>{formatMinorAmount(transfer.amountMinor, props.baseCurrency)}</ThemedText>
                <Pressable accessibilityRole="button" onPress={() => props.setExpandedSettlementKey(expanded ? undefined : key)} style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
                  <ThemedText type="small" style={{ color: props.linkColor }}>{expanded ? tx('收起付款设置', 'Hide payment settings') : tx('用其他币种付款', 'Pay in another currency')}</ThemedText>
                </Pressable>
              </View>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: false, busy: props.busySettlementId === key }}
                disabled={Boolean(props.busySettlementId)}
                onPress={() => void props.completeTransfer(transfer)}
                style={({ pressed }) => [styles.markPaidButton, props.compact && styles.markPaidButtonCompact, pressed && styles.pressed, Boolean(props.busySettlementId) && styles.disabled]}>
                <ThemedText type="smallBold" style={styles.quickAddText}>{tx('标记已转账', 'Mark sent')}</ThemedText>
              </Pressable>
              {expanded ? (
                <SettlementPaymentEditor
                  tx={tx}
                  baseCurrency={props.baseCurrency}
                  currencyOptions={props.currencyOptions}
                  transfer={transfer}
                  draft={draft}
                  setDraft={(next) => props.setSettlementDrafts((current) => ({ ...current, [key]: next }))}
                />
              ) : null}
            </View>
          );
        })}
      </View>

      {mySettlements.length > 0 ? (
        <View style={styles.sectionBlock}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showCompleted }}
            onPress={() => setShowCompleted((current) => !current)}
            style={({ pressed }) => [styles.settlementDisclosure, pressed && styles.pressed]}>
            <View style={styles.grow}>
              <ThemedText type="smallBold">{tx('已完成', 'Completed')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{tx(`${mySettlements.length} 笔`, `${mySettlements.length} payment${mySettlements.length === 1 ? '' : 's'}`)}</ThemedText>
            </View>
            <Chevron color={props.linkColor} direction={showCompleted ? 'down' : 'right'} />
          </Pressable>
          {showCompleted ? mySettlements.map((settlement) => {
            const sentByMe = settlement.fromUserId === props.currentUserId;
            const otherMember = props.memberById.get(sentByMe ? settlement.toUserId : settlement.fromUserId);
            return (
              <View key={settlement.id} style={styles.completedRow}>
                <MemberAvatar avatarUrl={otherMember?.avatarUrl} displayName={otherMember?.displayName ?? tx('同行者', 'Traveller')} size={38} />
                <View style={styles.grow}>
                  <ThemedText type="smallBold">
                    {sentByMe
                      ? tx(`已转给 ${props.names.get(settlement.toUserId) ?? '同行者'}`, `Sent to ${props.names.get(settlement.toUserId) ?? 'Traveller'}`)
                      : tx(`已收到 ${props.names.get(settlement.fromUserId) ?? '同行者'} 的转账`, `Received from ${props.names.get(settlement.fromUserId) ?? 'Traveller'}`)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{formatMinorAmount(settlement.amountMinor, settlement.currency)}</ThemedText>
                </View>
                {sentByMe ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={Boolean(props.busySettlementId)}
                    onPress={() => void props.undoTransfer(settlement)}
                    style={({ pressed }) => [styles.textButton, pressed && styles.pressed, Boolean(props.busySettlementId) && styles.disabled]}>
                    <ThemedText type="smallBold" style={{ color: props.linkColor }}>{tx('恢复未转账', 'Mark unsent')}</ThemedText>
                  </Pressable>
                ) : (
                  <ThemedText type="smallBold" style={{ color: props.positiveColor }}>{tx('已收入', 'Received')}</ThemedText>
                )}
              </View>
            );
          }) : null}
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: props.showGroupSettlement }}
        onPress={props.toggleGroupSettlement}
        style={({ pressed }) => [styles.settlementDisclosure, pressed && styles.pressed]}>
        <View style={styles.grow}>
          <ThemedText type="smallBold">{tx('全员结算', 'Group settlement')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{tx('查看全员状态', 'View group status')}</ThemedText>
        </View>
        <Chevron color={props.linkColor} direction={props.showGroupSettlement ? 'down' : 'right'} />
      </Pressable>

      {props.showGroupSettlement ? <View style={styles.sectionBlock}>
        {props.balanceSnapshots.map((snapshot) => (
          <View key={snapshot.currency} style={styles.groupCurrency}>
            <ThemedText type="smallBold" style={[styles.currencyDivider, { color: props.positiveColor }]}>{snapshot.currency}</ThemedText>
            {[...props.names.entries()].map(([userId, displayName]) => {
              const member = props.memberById.get(userId);
              const pendingOut = sumTransfers(snapshot.outstandingTransfers, 'from', userId);
              const pendingIn = sumTransfers(snapshot.outstandingTransfers, 'to', userId);
              const sent = sumSettlements(props.settlements, snapshot.currency, 'from', userId);
              const received = sumSettlements(props.settlements, snapshot.currency, 'to', userId);
              return (
                <View key={userId} style={styles.memberSettlementRow}>
                  <View style={styles.memberIdentity}>
                    <MemberAvatar avatarUrl={member?.avatarUrl} displayName={displayName} size={36} />
                    <View style={styles.grow}><ThemedText type="smallBold">{displayName}</ThemedText>{member?.archived ? <ThemedText type="small" themeColor="textSecondary">{tx('已离开行程', 'Left trip')}</ThemedText> : null}</View>
                  </View>
                  <View style={styles.memberMetrics}>
                    <MiniMetric label={tx('待转', 'Due')} value={pendingOut} currency={snapshot.currency} />
                    <MiniMetric label={tx('已转', 'Sent')} value={sent} currency={snapshot.currency} />
                    <MiniMetric label={tx('待收', 'Expected')} value={pendingIn} currency={snapshot.currency} />
                    <MiniMetric label={tx('已收', 'Received')} value={received} currency={snapshot.currency} color={props.positiveColor} />
                  </View>
                </View>
              );
            })}
          </View>
        ))}
        {props.pendingTransfers.length > 0 ? (
          <View style={styles.groupRouteList}>
            <ThemedText type="smallBold">{tx('剩余转账路径', 'Remaining transfers')}</ThemedText>
            {props.pendingTransfers.map((transfer) => {
              const from = props.memberById.get(transfer.fromParticipantId);
              const to = props.memberById.get(transfer.toParticipantId);
              return <View key={`${transfer.currency}-${transfer.fromParticipantId}-${transfer.toParticipantId}`} style={styles.routeRow}><MemberAvatar avatarUrl={from?.avatarUrl} displayName={from?.displayName ?? tx('同行者', 'Traveller')} size={30} /><ThemedText type="small" themeColor="textSecondary" style={styles.routeText}>{tx(`${from?.displayName ?? '同行者'} → ${to?.displayName ?? '同行者'}`, `${from?.displayName ?? 'Traveller'} → ${to?.displayName ?? 'Traveller'}`)}</ThemedText><MemberAvatar avatarUrl={to?.avatarUrl} displayName={to?.displayName ?? tx('同行者', 'Traveller')} size={30} /><ThemedText type="smallBold">{formatMinorAmount(transfer.amountMinor, transfer.currency)}</ThemedText></View>;
            })}
          </View>
        ) : props.balanceSnapshots.length > 0 ? (
          <ThemedText type="smallBold" style={{ color: props.positiveColor }}>{tx('全部结清', 'All settled')}</ThemedText>
        ) : null}
      </View> : null}
    </View>
  );
}

function ExpenseActivity(props: {
  tx: (zh: string, en: string) => string;
  expenses: Expense[];
  names: Map<string, string>;
  memberById: Map<string, TripMember>;
  formatDateTime: (value: string) => string;
  expandedExpenseId?: string;
  setExpandedExpenseId: (expenseId?: string) => void;
  onEditExpense: (expense: Expense) => void;
  canEditExpense: (expense: Expense) => boolean;
  settlementStatusByUser: Map<string, { label: string; color?: string }>;
  pickReceipt: (source: 'camera' | 'library', expenseId?: string) => Promise<void>;
  receiptBusy: boolean;
  themeSelected: string;
  positiveColor: string;
}) {
  const { tx } = props;
  if (props.expenses.length === 0) {
    return (
      <View style={styles.quietEmpty}>
        <ThemedText style={styles.sectionTitle}>{tx('还没有支出', 'No expenses yet')}</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.sectionBlock}>
      <SectionHeading title={tx('消费明细', 'Expense activity')} />
      {props.expenses.map((expense) => {
        const expanded = props.expandedExpenseId === expense.id;
        const primaryPayer = props.memberById.get(expense.payers[0]?.userId);
        const payerNames = expense.payers.map(({ userId }) => props.names.get(userId) ?? tx('同行者', 'Traveller')).join(tx('、', ', '));
        const shareText = expense.shares
          .map((share) => `${props.names.get(share.userId) ?? tx('同行者', 'Traveller')} ${formatMinorAmount(share.amountMinor, expense.currency)}`)
          .join(tx(' · ', ' · '));
        return (
          <View key={expense.id} style={styles.expenseItem}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              onPress={() => props.setExpandedExpenseId(expanded ? undefined : expense.id)}
              style={({ pressed }) => [styles.expenseSummary, pressed && styles.pressed]}>
              <MemberAvatar avatarUrl={primaryPayer?.avatarUrl} displayName={primaryPayer?.displayName ?? tx('同行者', 'Traveller')} size={38} />
              <View style={styles.grow}>
                <ThemedText type="smallBold">{expense.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {props.formatDateTime(expense.occurredAt)} · {tx(`${payerNames} 付款`, `Paid by ${payerNames}`)}
                </ThemedText>
              </View>
              <View style={styles.expenseAmountBlock}>
                <ThemedText type="smallBold">{formatMinorAmount(expense.totalMinor, expense.currency)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{expense.baseCurrency && expense.baseCurrency !== expense.currency ? tx(`记入 ${expense.baseCurrency} ${formatMinorAmount(expense.baseAmountMinor ?? 0, expense.baseCurrency)}`, `Books ${formatMinorAmount(expense.baseAmountMinor ?? 0, expense.baseCurrency)}`) : tx('本位币', 'Base currency')}</ThemedText>
                {(expense.receipts?.length ?? 0) > 0 ? <ThemedText type="small" style={{ color: props.positiveColor }}>{tx('有小票', 'Receipt')}</ThemedText> : null}
              </View>
            </Pressable>
            {expanded ? (
              <View style={styles.expenseDetails}>
                <View style={styles.detailLine}><ThemedText type="smallBold">{tx('分摊', 'Split')}</ThemedText><ThemedText type="small" themeColor="textSecondary" style={styles.grow}>{shareText}</ThemedText></View>
                <View style={styles.detailLine}><ThemedText type="smallBold">{tx('结算', 'Settlement')}</ThemedText><ThemedText type="small" themeColor="textSecondary" style={styles.grow}>{tx('按当前账本合并显示每位同行者的转账状态。', 'Status is calculated across the current trip ledger.')}</ThemedText></View>
                <View style={styles.sharePeople}>{expense.shares.map((share) => { const member = props.memberById.get(share.userId); const status = props.settlementStatusByUser.get(share.userId); return <View key={share.userId} style={styles.sharePerson}><MemberAvatar avatarUrl={member?.avatarUrl} displayName={member?.displayName ?? tx('同行者', 'Traveller')} size={30} /><ThemedText type="small" style={styles.grow}>{member?.displayName ?? tx('同行者', 'Traveller')}</ThemedText><View style={styles.shareAmount}><ThemedText type="smallBold">{formatMinorAmount(share.amountMinor, expense.currency)}</ThemedText><ThemedText type="smallBold" style={status?.color ? { color: status.color } : undefined}>{status?.label ?? tx('待结算', 'Pending')}</ThemedText></View></View>; })}</View>
                {(expense.receipts?.length ?? 0) > 0 ? (
                  <View style={styles.receiptGallery}>
                    {expense.receipts?.map((item, index) => item.signedUrl ? (
                      <Pressable
                        key={item.id}
                        accessibilityRole="link"
                        accessibilityLabel={tx(`查看 ${expense.title} 的第 ${index + 1} 张小票`, `View receipt ${index + 1} for ${expense.title}`)}
                        onPress={() => void Linking.openURL(item.signedUrl!)}
                        style={({ pressed }) => pressed && styles.pressed}>
                        <Image source={item.signedUrl} style={styles.receiptLarge} contentFit="contain" />
                      </Pressable>
                    ) : null)}
                  </View>
                ) : (
                  <ThemedText type="small" themeColor="textSecondary">{tx('这笔支出还没有小票。', 'No receipt has been attached yet.')}</ThemedText>
                )}
                <View style={styles.receiptActions}>
                  <Pressable disabled={props.receiptBusy} accessibilityRole="button" onPress={() => void props.pickReceipt('camera', expense.id)} style={({ pressed }) => [styles.secondaryAction, { backgroundColor: props.themeSelected }, pressed && styles.pressed, props.receiptBusy && styles.disabled]}>
                    <ThemedText type="smallBold">{tx('拍照补充', 'Take photo')}</ThemedText>
                  </Pressable>
                  <Pressable disabled={props.receiptBusy} accessibilityRole="button" onPress={() => void props.pickReceipt('library', expense.id)} style={({ pressed }) => [styles.secondaryAction, { backgroundColor: props.themeSelected }, pressed && styles.pressed, props.receiptBusy && styles.disabled]}>
                    <ThemedText type="smallBold">{tx('相册补充', 'Choose photo')}</ThemedText>
                  </Pressable>
                </View>
                {props.canEditExpense(expense) ? (
                  <Pressable accessibilityRole="button" onPress={() => props.onEditExpense(expense)} style={({ pressed }) => [styles.editExpenseButton, pressed && styles.pressed]}>
                    <ThemedText type="smallBold">{tx('编辑这笔支出', 'Edit expense')}</ThemedText>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.metric}>
      <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
      <ThemedText type="smallBold" style={color ? { color } : undefined}>{value}</ThemedText>
    </View>
  );
}

function MiniMetric({ label, value, currency, color }: { label: string; value: number; currency: string; color?: string }) {
  return (
    <View style={styles.miniMetric}>
      <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
      <ThemedText type="smallBold" style={color && value > 0 ? { color } : undefined}>{formatMinorAmount(value, currency)}</ThemedText>
    </View>
  );
}

function sumTransfers(transfers: SettlementTransfer[], direction: 'from' | 'to', userId: string) {
  return transfers.reduce((sum, transfer) => {
    const matches = direction === 'from'
      ? transfer.fromParticipantId === userId
      : transfer.toParticipantId === userId;
    return matches ? sum + transfer.amountMinor : sum;
  }, 0);
}

function sumSettlements(settlements: Settlement[], currency: string, direction: 'from' | 'to', userId: string) {
  return settlements.reduce((sum, settlement) => {
    const matches = settlement.currency === currency && (direction === 'from'
      ? settlement.fromUserId === userId
      : settlement.toUserId === userId);
    return matches ? sum + settlement.amountMinor : sum;
  }, 0);
}

function amountInputFromMinor(amountMinor: number, currency: string) {
  const digits = currencyMinorDigits(currency);
  return (amountMinor / 10 ** digits).toFixed(digits);
}

const styles = StyleSheet.create({
  workspace: { gap: 30 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  toolbarCompact: { alignItems: 'stretch' },
  viewSwitch: { flexDirection: 'row', padding: 4, borderRadius: 14, flex: 1, maxWidth: 320 },
  viewSwitchCompact: { maxWidth: '100%' },
  viewSwitchButton: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingHorizontal: 14 },
  viewSwitchButtonActive: { backgroundColor: '#087F6A' },
  viewSwitchTextActive: { color: '#FFFFFF' },
  quickAddText: { color: '#FFFFFF' },
  floatingAdd: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#087F6A', alignItems: 'center', justifyContent: 'center', shadowColor: '#15344A', shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  plusIcon: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  plusHorizontal: { position: 'absolute', width: 18, height: 2, borderRadius: 1, backgroundColor: '#FFFFFF' },
  plusVertical: { position: 'absolute', width: 2, height: 18, borderRadius: 1, backgroundColor: '#FFFFFF' },
  composer: { gap: 20, borderRadius: 16, padding: 20, shadowColor: '#15344A', shadowOpacity: 0.1, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  composerCompact: { padding: 16, gap: 16 },
  composerHeading: { gap: 12 },
  composerTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  formGroup: { gap: 16 },
  amountRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-end' },
  amountRowCompact: { flexDirection: 'column', alignItems: 'stretch', gap: 14 },
  currencyField: { width: 116 },
  currencyFieldCompact: { width: '100%' },
  conversionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12, borderRadius: 12, padding: 12 },
  conversionPreview: { flexGrow: 1, flexBasis: 150, gap: 2, paddingBottom: 10 },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  voiceGroup: { gap: 8 },
  voiceControlRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  voiceButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1B70A6' },
  voiceButtonRecording: { backgroundColor: '#B4413E' },
  micGlyph: { width: 24, height: 28, alignItems: 'center', justifyContent: 'flex-start' },
  micBody: { width: 10, height: 16, borderRadius: 6, backgroundColor: '#FFFFFF' },
  micBodyActive: { backgroundColor: '#FFF5F3' },
  micArc: { position: 'absolute', top: 8, width: 20, height: 14, borderWidth: 2, borderTopColor: 'transparent', borderLeftColor: '#FFFFFF', borderRightColor: '#FFFFFF', borderBottomColor: '#FFFFFF', borderRadius: 12 },
  micArcActive: { borderLeftColor: '#FFF5F3', borderRightColor: '#FFF5F3', borderBottomColor: '#FFF5F3' },
  micStem: { position: 'absolute', bottom: 2, width: 2, height: 6, borderRadius: 1, backgroundColor: '#FFFFFF' },
  micStemActive: { backgroundColor: '#FFF5F3' },
  micBase: { position: 'absolute', bottom: 0, width: 14, height: 2, borderRadius: 1, backgroundColor: '#FFFFFF' },
  micBaseActive: { backgroundColor: '#FFF5F3' },
  fieldGroup: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  splitFields: { gap: 10, padding: 12, borderRadius: 12 },
  splitPreview: { gap: 4, padding: 12, borderRadius: 12 },
  memberChoice: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999 },
  memberChoiceTextSelected: { color: '#FFFFFF' },
  receiptGroup: { gap: 10, paddingTop: 4 },
  receiptCopy: { gap: 2 },
  receiptActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  secondaryAction: { minHeight: 44, flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 12 },
  receiptPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  receiptPreview: { width: 80, height: 80, borderRadius: 12, backgroundColor: '#D9EEEA' },
  personalSummary: { gap: 18, paddingVertical: 6 },
  summaryHeading: { gap: 4 },
  sectionTitle: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  personalCurrencyRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 14, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#AFCACA' },
  personalCurrencyRowCompact: { gap: 10 },
  currencyIdentity: { minWidth: 90, gap: 2, paddingBottom: 2 },
  currencyCode: { minWidth: 42, paddingBottom: 2 },
  metric: { minWidth: 94, flexGrow: 1, gap: 2 },
  sectionBlock: { gap: 0 },
  sectionHeading: { gap: 4, paddingBottom: 10 },
  transferRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#AFCACA' },
  transferRowCompact: { flexDirection: 'column', alignItems: 'stretch', gap: 10 },
  transferCopy: { gap: 2, flex: 1 },
  transferAmount: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  markPaidButton: { minHeight: 44, minWidth: 112, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingHorizontal: 14, backgroundColor: '#087F6A' },
  markPaidButtonCompact: { width: '100%' },
  paymentEditor: { flexBasis: '100%', gap: 10, paddingTop: 8, paddingLeft: 54 },
  paymentEditorCompact: { paddingLeft: 0 },
  paymentEditorFields: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 },
  paymentEditorFieldsCompact: { flexDirection: 'column', alignItems: 'stretch' },
  paymentCurrencyField: { width: 150 },
  paymentCurrencyFieldCompact: { width: '100%' },
  completedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#AFCACA' },
  textButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  quietEmpty: { gap: 4, paddingVertical: 22, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#AFCACA' },
  settlementDisclosure: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#AFCACA' },
  groupCurrency: { gap: 0, paddingBottom: 18 },
  currencyDivider: { paddingVertical: 10 },
  memberSettlementRow: { gap: 8, paddingVertical: 13, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#AFCACA' },
  memberIdentity: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberName: { flex: 1 },
  memberMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  miniMetric: { minWidth: '45%', flexGrow: 1, gap: 1 },
  groupRouteList: { gap: 5, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#AFCACA' },
  routeRow: { minHeight: 44, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }, routeText: { flexGrow: 1, flexShrink: 1 },
  expenseItem: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#AFCACA' },
  expenseSummary: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  expenseAmountBlock: { alignItems: 'flex-end', gap: 2 },
  expenseDetails: { gap: 14, paddingBottom: 18 },
  editExpenseButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingHorizontal: 14, backgroundColor: '#D9EEEA' },
  detailLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  sharePeople: { gap: 6 }, sharePerson: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 10 }, shareAmount: { alignItems: 'flex-end', gap: 1 },
  receiptGallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  receiptLarge: { width: 160, height: 190, borderRadius: 12, backgroundColor: '#D9EEEA' },
  grow: { flex: 1 },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.5 },
});
