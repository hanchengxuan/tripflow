import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Fragment, useMemo, useState } from 'react';
import { LayoutAnimation, Linking, Pressable, StyleSheet, View } from 'react-native';

import { InlineNotice } from '@/components/form-controls';
import { ExpenseComposer, type ReceiptDraft } from '@/components/expense-composer';
import { BottomSheet } from '@/components/bottom-sheet';
import { MemberAvatar } from '@/components/member-avatar';
import { ListDivider, ListSurface } from '@/components/list-surface';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import {
  SettlementWorkspace,
  amountInputFromMinor,
  type BalanceSnapshot as SettlementWorkspaceBalanceSnapshot,
  type SettlementDraft,
} from '@/components/settlement-workspace';
import { ThemedText } from '@/components/themed-text';
import { getCurrencyOptions } from '@/constants/options';
import {
  calculateBalancesByCurrency,
  calculateOutstandingBalancesByCurrency,
  calculateBalancesInCurrency,
  convertMinorAmount,
  formatMinorAmount,
  parseExchangeRate,
  parseAmountToMinor,
} from '@/domain/ledger';
import { minimizeSettlementTransfers, splitByExactAmounts, splitByPercentages, splitByWeights, splitEqually, type SettlementTransfer } from '@/domain/money';
import type { Expense, ItineraryItem, Settlement, TripMember } from '@/domain/models';
import { type AiExpenseDraft, parseExpenseAudio, parseExpenseText } from '@/features/ai/expense-parser';
import { formatExchangeRate } from '@/features/currency/exchange-rate';
import { useExchangeRate, type ExchangeRateLoadState } from '@/features/currency/use-exchange-rate';
import { useI18n } from '@/features/i18n/i18n-provider';
import { defaultAllocationValueFor } from '@/features/ledger/default-allocation';
import { useMvp } from '@/features/mvp/mvp-provider';
import { InputError } from '@/domain/input-error';
import { validateExpenseDraft } from '@/features/ledger/validate-expense-draft';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/user-error';

type BalanceSnapshot = SettlementWorkspaceBalanceSnapshot;

export default function LedgerScreen() {
  const theme = useTheme();
  const { locale, formatDateTime, tx } = useI18n();
  const {
    activeTrip,
    members,
    ledgerMembers,
    itineraryItems,
    expenses,
    settlements,
    currentUserId,
    addCustomExpense,
    updateCustomExpense,
    setExpenseSettled,
    attachExpenseReceipt,
    markSettlement,
    unmarkSettlement,
    error,
  } = useMvp();
  const [activeView, setActiveView] = useState<'settle' | 'activity'>('settle');
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string>();
  const [itineraryItemId, setItineraryItemId] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currencyOverride, setCurrencyOverride] = useState('');
  const [exchangeRate, setExchangeRate] = useState('1');
  const [exchangeRateSource, setExchangeRateSource] = useState('same-currency-default');
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
  const [busyExpenseId, setBusyExpenseId] = useState<string>();
  const [busySettlementId, setBusySettlementId] = useState<string>();
  const [settlementDrafts, setSettlementDrafts] = useState<Record<string, SettlementDraft>>({});
  const [formError, setFormError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [aiNotice, setAiNotice] = useState<string>();

  const currency = currencyOverride || activeTrip?.homeCurrency || 'HKD';
  const baseCurrency = activeTrip?.homeCurrency || 'HKD';
  const automaticExchangeRate = useExchangeRate({
    sourceCurrency: currency,
    targetCurrency: baseCurrency,
    enabled: composerOpen && !editingExpenseId,
  });
  const exchangeRatePairKey = `${currency.toUpperCase()}/${baseCurrency.toUpperCase()}`;
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
  const itineraryOptions = useMemo(
    () => [
      { value: '', label: tx('不关联安排', 'No linked plan') },
      ...[...itineraryItems]
        .sort((left, right) => left.startsAt.localeCompare(right.startsAt))
        .map((item) => ({
          value: item.id,
          label: `${item.title} · ${formatDateTime(item.startsAt)}`,
        })),
    ],
    [formatDateTime, itineraryItems, tx],
  );
  const positiveColor = theme.moneyIn;
  const moneyOutColor = theme.moneyOut;
  const dangerColor = theme.danger;

  const exchangeRateState: ExchangeRateLoadState = automaticExchangeRate.pairKey === exchangeRatePairKey
    ? automaticExchangeRate
    : { pairKey: exchangeRatePairKey, status: 'loading' };
  const automaticRateValue = exchangeRateState.status === 'success' && exchangeRateState.rate !== undefined
    ? formatExchangeRate(exchangeRateState.rate)
    : undefined;
  const effectiveExchangeRate = exchangeRateSource === 'frankfurter' ? automaticRateValue ?? exchangeRate : exchangeRate;

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
    const nextSource = nextCurrency.toUpperCase() === baseCurrency.toUpperCase() ? 'same-currency-default' : 'frankfurter';
    setExchangeRate(nextSource === 'same-currency-default' ? '1' : '');
    setExchangeRateSource(nextSource);
  }

  function chooseItineraryItem(nextItemId: string) {
    setItineraryItemId(nextItemId);
    if (editingExpenseId) return;
    const item = itineraryItems.find(({ id }) => id === nextItemId);
    if (item?.destination?.currency) chooseCurrency(item.destination.currency);
  }

  function changeExchangeRate(nextRate: string) {
    setExchangeRate(nextRate);
    if (currency.toUpperCase() !== baseCurrency.toUpperCase()) setExchangeRateSource('manual');
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
    () => normalizedBalance
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
        ? { label: tx(`待转给 ${names.get(outgoing.toParticipantId) ?? '同行者'}`, `Pending to ${names.get(outgoing.toParticipantId) ?? 'traveller'}`), color: moneyOutColor }
        : completedOutgoing
          ? { label: tx('已转账', 'Sent') }
          : completedIncoming
            ? { label: tx('已收款', 'Received'), color: positiveColor }
            : { label: tx('待结算', 'Pending') });
    }
    return statuses;
  }, [ledgerMembers, moneyOutColor, names, pendingTransfers, positiveColor, settlements, tx]);

  function resetExpenseForm() {
    setEditingExpenseId(undefined);
    setItineraryItemId('');
    setTitle('');
    setAmount('');
    setCurrencyOverride('');
    setExchangeRate('1');
    setExchangeRateSource('same-currency-default');
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
    setComposerOpen(false);
    resetExpenseForm();
    setSuccess(undefined);
  }

  function toggleComposer() {
    if (composerOpen) {
      closeComposer();
      return;
    }
    resetExpenseForm();
    setComposerOpen(true);
    setFormError(undefined);
    setSuccess(undefined);
  }

  function startEditingExpense(expense: Expense) {
    setActiveView('activity');
    setComposerOpen(true);
    setEditingExpenseId(expense.id);
    setItineraryItemId(expense.itineraryItemId ?? '');
    setTitle(expense.title);
    setAmount(amountInputFromMinor(expense.totalMinor, expense.currency));
    setCurrencyOverride(expense.currency);
    setExchangeRate(expense.exchangeRate ? String(expense.exchangeRate) : expense.currency.toUpperCase() === baseCurrency.toUpperCase() ? '1' : '');
    setExchangeRateSource(expense.exchangeRateSource ?? (expense.currency.toUpperCase() === baseCurrency.toUpperCase() ? 'same-currency-default' : 'manual'));
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
      setFormError(toUserMessage(caught, tx('无法添加小票，请稍后重试。', 'Could not add the receipt. Please try again.'), locale));
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
      setFormError(toUserMessage(caught, tx('AI 解析失败，请换一种说法或手动填写。', 'AI could not parse that. Rephrase it or enter the details manually.'), locale));
    } finally {
      setBusyAction(undefined);
    }
  }

  function applyAiDraft(draft: AiExpenseDraft) {
    if (!activeTrip) return;
    setTitle(draft.title);
    setAmount(draft.amount);
    chooseCurrency(draft.currency);
    setPayerOverride(draft.payerUserId);
    setPayerIds([draft.payerUserId]);
    setPayerAmounts({});
    setSplitMode('equal');
    setAllocationValues({});
    setParticipantsByTrip((current) => ({ ...current, [activeTrip.id]: draft.participantUserIds }));
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
      setFormError(toUserMessage(caught, tx('AI 无法识别这段语音，请重试或手动填写。', 'AI could not understand the recording. Try again or enter it manually.'), locale));
    } finally {
      setBusyAction(undefined);
    }
  }

  async function submitExpense() {
    let validated: ReturnType<typeof validateExpenseDraft>;
    try {
      validated = validateExpenseDraft({ tripId: activeTrip?.id, title, amount, currency, baseCurrency,
        exchangeRate: effectiveExchangeRate, participantIds, selectedPayerIds, payerAmounts, allocationPreview });
    } catch (caught) {
      setFormError(toUserMessage(caught, tx('请检查金额、汇率和分摊设置。', 'Check the amount, rate, and split.'), locale));
      return;
    }
    const { totalMinor, rate, baseAmountMinor, payerAllocations } = validated;
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
          exchangeRateSource: currency.toUpperCase() === baseCurrency.toUpperCase() ? 'same-currency-default' : exchangeRateSource,
          payerAllocations: payerAllocationsInput,
          shareAllocations: shareAllocationsInput,
          itineraryItemId: itineraryItemId || undefined,
        })
        : await addCustomExpense({
          title,
          currency: currency.toUpperCase(),
          totalMinor,
          baseCurrency: baseCurrency.toUpperCase(),
          baseAmountMinor,
          exchangeRate: rate,
          exchangeRateSource: currency.toUpperCase() === baseCurrency.toUpperCase() ? 'same-currency-default' : exchangeRateSource,
          payerAllocations: payerAllocationsInput,
          shareAllocations: shareAllocationsInput,
          itineraryItemId: itineraryItemId || undefined,
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
      setExchangeRateSource('same-currency-default');
      setAiText('');
      setReceipt(undefined);
      setPayerIds([]);
      setPayerAmounts({});
      setAllocationValues({});
      setSplitMode('equal');
      setAiNotice(undefined);
      setEditingExpenseId(undefined);
      setItineraryItemId('');
      setComposerOpen(false);
      setActiveView('activity');
      if (!editingExpenseId || !receipt) {
        setSuccess('receiptError' in result && result.receiptError
          ? tx('支出已保存，但小票上传失败；可在支出详情中重新添加。', 'Expense saved, but the receipt upload failed. Add it again from the expense details.')
          : 'itineraryLinkError' in result && result.itineraryLinkError
            ? tx('支出已保存，但关联安排失败；可稍后在明细中补充。', 'Expense saved, but linking the plan failed. Add the link later from the details.')
            : 'refreshError' in result && result.refreshError
              ? tx('支出已保存，但账本刷新失败；请刷新页面确认。', 'Expense saved, but the ledger could not refresh. Reload to confirm it.')
          : editingExpenseId
            ? tx('支出已更新，分摊和结算待办已更新。', 'Expense updated. Shares and settlement tasks are updated.')
            : tx('支出已保存，分摊和结算待办已更新。', 'Expense saved. Shares and settlement tasks are updated.'));
      }
    } catch (caught) {
      setFormError(toUserMessage(caught, tx('无法保存支出，请稍后重试。', 'Could not save the expense. Please try again.'), locale));
    } finally {
      setBusyAction(undefined);
    }
  }

  async function completeTransfer(transfer: SettlementTransfer & { currency: string }): Promise<boolean> {
    const transferKey = `${transfer.currency}-${transfer.fromParticipantId}-${transfer.toParticipantId}`;
    const draft = settlementDrafts[transferKey] ?? { currency: baseCurrency, amount: amountInputFromMinor(transfer.amountMinor, baseCurrency), rate: '1' };
    setBusySettlementId(transferKey);
    setFormError(undefined);
    setSuccess(undefined);
    try {
      const amountMinor = parseAmountToMinor(draft.amount, draft.currency);
      const exchangeRate = draft.currency.toUpperCase() === baseCurrency.toUpperCase() ? 1 : parseExchangeRate(draft.rate);
      const baseAmountMinor = convertMinorAmount(amountMinor, draft.currency, baseCurrency, exchangeRate);
      if (baseAmountMinor > transfer.amountMinor) throw new InputError('折算金额不能超过待转余额。', 'The converted amount cannot exceed the amount due.');
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
      setSuccess(tx('已标记为已转账，收款方的“已收入”会同步更新。', 'Marked as sent. The recipient’s received total is updated automatically.'));
      return true;
    } catch (caught) {
      setFormError(toUserMessage(caught, tx('无法更新转账状态，请刷新后重试。', 'Could not update the transfer. Refresh and try again.'), locale));
      return false;
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
      setFormError(toUserMessage(caught, tx('无法撤销转账状态，请稍后重试。', 'Could not undo the transfer status. Please try again.'), locale));
    } finally {
      setBusySettlementId(undefined);
    }
  }

  async function toggleExpenseSettlement(expense: Expense) {
    setBusyExpenseId(expense.id);
    setFormError(undefined);
    setSuccess(undefined);
    try {
      await setExpenseSettled(expense.id, !expense.settledAt);
      setSuccess(expense.settledAt ? tx('已恢复为未结清。', 'Marked as unsettled again.') : tx('这笔支出已标记为结清。', 'This expense is marked as settled.'));
    } catch (caught) {
      setFormError(toUserMessage(caught, tx('无法更新结清状态，请稍后重试。', 'Could not update the settlement state. Please try again.'), locale));
    } finally {
      setBusyExpenseId(undefined);
    }
  }

  return (
    <>
      <Screen
      context={activeTrip
        ? [
            activeTrip.name,
            tx(`${expenses.length} 笔支出`, `${expenses.length} expenses`),
            myPendingTransfers.length > 0
              ? tx(`${myPendingTransfers.length} 笔待转`, `${myPendingTransfers.length} to send`)
              : tx(`本位币 ${activeTrip.homeCurrency}`, `Home currency ${activeTrip.homeCurrency}`),
          ]
        : [tx('还没有进行中的行程', 'No active trip yet')]}
      title={tx('账本', 'Ledger')}
      floatingAction={activeTrip ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={composerOpen ? tx('关闭记账', 'Close expense entry') : tx('记一笔', 'Add expense')}
          accessibilityState={{ expanded: composerOpen }}
          onPress={toggleComposer}
          style={({ pressed }) => [styles.floatingAdd, { backgroundColor: theme.accent, shadowColor: theme.shadow }, pressed && styles.pressed]}>
          <View style={styles.plusIcon}>
            <View style={[styles.plusHorizontal, { backgroundColor: theme.textOnAccent }]} />
            <View style={[styles.plusVertical, { backgroundColor: theme.textOnAccent }]} />
          </View>
        </Pressable>
      ) : null}>
      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
      {!composerOpen && formError ? <InlineNotice tone="error">{formError}</InlineNotice> : null}
      {success ? <InlineNotice>{success}</InlineNotice> : null}

      {activeTrip ? (
        <View style={styles.toolbar}>
          <SegmentedControl
            options={[{ label: tx('结算', 'Settle'), value: 'settle' }, { label: tx('明细', 'Activity'), value: 'activity' }]}
            value={activeView}
            onChange={setActiveView}
          />
        </View>
      ) : null}

      {!activeTrip ? (
        <InlineNotice>{tx('请先创建或加入一个行程，再开始记账。', 'Create or join a trip before using the ledger.')}</InlineNotice>
      ) : activeView === 'settle' ? (
        <SettlementWorkspace
          balanceSnapshots={balanceSnapshots}
          baseCurrency={baseCurrency}
          busySettlementId={busySettlementId}
          completeTransfer={completeTransfer}
          currencyOptions={currencyOptions}
          currentUserId={currentUserId}
          hasCompleteConversions={Boolean(hasCompleteConversions)}
          memberById={memberById}
          myIncomingTransfers={myIncomingTransfers}
          myPendingTransfers={myPendingTransfers}
          names={names}
          pendingTransfers={pendingTransfers}
          settlementDrafts={settlementDrafts}
          settlements={settlements}
          setSettlementDrafts={setSettlementDrafts}
          summaryTransfers={normalizedPendingTransfers}
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
          itineraryItems={itineraryItems}
          onToggleExpenseSettled={toggleExpenseSettlement}
          busyExpenseId={busyExpenseId}
          pickReceipt={pickReceipt}
          receiptBusy={busyAction === 'receipt'}
          themeSelected={theme.backgroundSelected}
          positiveColor={positiveColor}
        />
      )}
      </Screen>

      <BottomSheet
        onDismiss={closeComposer}
        title={editingExpenseId ? tx('编辑支出', 'Edit expense') : tx('记一笔', 'Add expense')}
        visible={Boolean(activeTrip && composerOpen)}>
        <ExpenseComposer
          aiNotice={aiNotice}
          aiText={aiText}
          allocationPreview={allocationPreview}
          allocationValues={allocationValues}
          amount={amount}
          baseCurrency={baseCurrency}
          busyAction={busyAction}
          changeSplitMode={changeSplitMode}
          currency={currency}
          currencyOptions={currencyOptions}
          dangerColor={dangerColor}
          editing={Boolean(editingExpenseId)}
          exchangeRate={effectiveExchangeRate}
          exchangeRateSource={exchangeRateSource}
          exchangeRateState={exchangeRateState}
          formError={formError}
          itineraryItemId={itineraryItemId}
          itineraryOptions={itineraryOptions}
          members={members}
          names={names}
          parseVoiceExpense={parseVoiceExpense}
          parseWithAi={parseWithAi}
          participantIds={participantIds}
          payerAmounts={payerAmounts}
          pickReceipt={pickReceipt}
          receipt={receipt}
          selectedPayerIds={selectedPayerIds}
          setAiText={setAiText}
          setAllocationValue={(userId, value) => setAllocationValues((current) => ({ ...current, [userId]: value }))}
          setAmount={setAmount}
          setCurrencyOverride={chooseCurrency}
          setExchangeRate={changeExchangeRate}
          setItineraryItemId={chooseItineraryItem}
          setPayerAmount={(userId, value) => setPayerAmounts((current) => ({ ...current, [userId]: value }))}
          setReceipt={setReceipt}
          setTitle={setTitle}
          splitMode={splitMode}
          submitExpense={submitExpense}
          themeSelected={theme.backgroundSelected}
          title={title}
          toggleParticipant={toggleParticipant}
          togglePayer={togglePayer}
          tx={tx}
        />
      </BottomSheet>
    </>
  );
}

function ExpenseActivity(props: {
  tx: (zh: string, en: string) => string;
  expenses: Expense[];
  itineraryItems: ItineraryItem[];
  names: Map<string, string>;
  memberById: Map<string, TripMember>;
  formatDateTime: (value: string) => string;
  expandedExpenseId?: string;
  setExpandedExpenseId: (expenseId?: string) => void;
  onEditExpense: (expense: Expense) => void;
  canEditExpense: (expense: Expense) => boolean;
  settlementStatusByUser: Map<string, { label: string; color?: string }>;
  onToggleExpenseSettled: (expense: Expense) => Promise<void>;
  busyExpenseId?: string;
  pickReceipt: (source: 'camera' | 'library', expenseId?: string) => Promise<void>;
  receiptBusy: boolean;
  themeSelected: string;
  positiveColor: string;
}) {
  const { tx } = props;
  const theme = useTheme();
  if (props.expenses.length === 0) {
    return (
      <View style={[styles.quietEmpty, { borderTopColor: theme.border }]}>
        <ThemedText style={styles.sectionTitle}>{tx('还没有支出', 'No expenses yet')}</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.activityWorkspace}>
      <ListSurface>
      {props.expenses.map((expense, index) => {
        const expanded = props.expandedExpenseId === expense.id;
        const linkedItem = props.itineraryItems.find((item) => item.id === expense.itineraryItemId);
        const primaryPayer = props.memberById.get(expense.payers[0]?.userId);
        const payerNames = expense.payers.map(({ userId }) => props.names.get(userId) ?? tx('同行者', 'Traveller')).join(tx('、', ', '));
        const shareText = expense.shares
          .map((share) => `${props.names.get(share.userId) ?? tx('同行者', 'Traveller')} ${formatMinorAmount(share.amountMinor, expense.currency)}`)
          .join(tx(' · ', ' · '));
        return (
          <Fragment key={expense.id}>
          {index > 0 ? <ListDivider /> : null}
          <View style={styles.expenseItem}>
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
                <ThemedText type="smallBold" style={{ color: expense.settledAt ? props.positiveColor : undefined }}>
                  {expense.settledAt ? tx('已结清', 'Settled') : tx('待结清', 'Unsettled')}
                </ThemedText>
              </View>
            </Pressable>
            {expanded ? (
              <View style={styles.expenseDetails}>
                <View style={styles.detailLine}><ThemedText type="smallBold">{tx('分摊', 'Split')}</ThemedText><ThemedText type="small" themeColor="textSecondary" style={styles.grow}>{shareText}</ThemedText></View>
                <View style={styles.detailLine}><ThemedText type="smallBold">{tx('结算', 'Settlement')}</ThemedText><ThemedText type="small" themeColor="textSecondary" style={styles.grow}>{tx('按当前账本合并显示每位同行者的转账状态。', 'Status is calculated across the current trip ledger.')}</ThemedText></View>
                <View style={styles.detailLine}>
                  <ThemedText type="smallBold">{tx('这笔状态', 'Expense status')}</ThemedText>
                  <View style={styles.grow}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {expense.settledAt
                        ? expense.settlementSource === 'automatic'
                          ? tx('所有待转款项完成后自动结清', 'Automatically settled after all transfers completed')
                          : tx('手动标记为已结清', 'Marked settled manually')
                        : tx('仍有待结算金额', 'Transfers are still outstanding')}
                    </ThemedText>
                    {props.canEditExpense(expense) ? (
                      <Pressable
                        accessibilityRole="button"
                        disabled={Boolean(props.busyExpenseId)}
                        onPress={() => void props.onToggleExpenseSettled(expense)}
                        style={({ pressed }) => [styles.textButton, pressed && styles.pressed, Boolean(props.busyExpenseId) && styles.disabled]}>
                        <ThemedText type="smallBold" style={{ color: props.positiveColor }}>
                          {expense.settledAt ? tx('恢复未结清', 'Mark unsettled') : tx('标记已结清', 'Mark settled')}
                        </ThemedText>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
                {linkedItem ? (
                  <View style={styles.detailLine}>
                    <ThemedText type="smallBold">{tx('关联安排', 'Linked plan')}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.grow}>
                      {linkedItem.title} · {props.formatDateTime(linkedItem.startsAt)}
                    </ThemedText>
                  </View>
                ) : null}
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
                        <Image source={item.signedUrl} style={[styles.receiptLarge, { backgroundColor: theme.backgroundSelected }]} contentFit="contain" />
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
                  <Pressable accessibilityRole="button" onPress={() => props.onEditExpense(expense)} style={({ pressed }) => [styles.editExpenseButton, { backgroundColor: theme.accentSoft }, pressed && styles.pressed]}>
                    <ThemedText type="smallBold">{tx('编辑这笔支出', 'Edit expense')}</ThemedText>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
          </Fragment>
        );
      })}
      </ListSurface>
      <ThemedText type="small" themeColor="textSecondary">{tx('展开任意一笔，可查看分摊金额和小票。', 'Open any expense to see split amounts and receipts.')}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  quietEmpty: { gap: 4, paddingVertical: 22, borderTopWidth: StyleSheet.hairlineWidth },
  sectionTitle: { fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  activityWorkspace: { gap: 12 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  floatingAdd: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  plusIcon: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  plusHorizontal: { position: 'absolute', width: 18, height: 2, borderRadius: 1 },
  plusVertical: { position: 'absolute', width: 2, height: 18, borderRadius: 1 },
  receiptActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  secondaryAction: { minHeight: 44, flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 12 },
  textButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  expenseItem: {},
  expenseSummary: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  expenseAmountBlock: { alignItems: 'flex-end', gap: 2 },
  expenseDetails: { gap: 14, paddingBottom: 18 },
  editExpenseButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingHorizontal: 14 },
  detailLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  sharePeople: { gap: 6 }, sharePerson: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 10 }, shareAmount: { alignItems: 'flex-end', gap: 1 },
  receiptGallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  receiptLarge: { width: 160, height: 190, borderRadius: 12 },
  grow: { flex: 1 },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.5 },
});
