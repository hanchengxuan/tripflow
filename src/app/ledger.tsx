import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useMemo, useState } from 'react';
import { LayoutAnimation, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ActionButton, ChoiceChip, FormField, InlineNotice } from '@/components/form-controls';
import { MemberAvatar } from '@/components/member-avatar';
import { Screen } from '@/components/screen';
import { SelectionField } from '@/components/selection-field';
import { ThemedText } from '@/components/themed-text';
import { getCurrencyOptions } from '@/constants/options';
import {
  calculateBalancesByCurrency,
  calculateOutstandingBalancesByCurrency,
  formatMinorAmount,
  parseAmountToMinor,
} from '@/domain/ledger';
import { minimizeSettlementTransfers, type SettlementTransfer } from '@/domain/money';
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

export default function LedgerScreen() {
  const theme = useTheme();
  const { locale, formatDateTime, tx } = useI18n();
  const {
    activeTrip,
    members,
    ledgerMembers,
    expenses,
    settlements,
    currentUserId,
    addEqualExpense,
    attachExpenseReceipt,
    markSettlement,
    unmarkSettlement,
    loading,
    error,
  } = useMvp();
  const [activeView, setActiveView] = useState<'settle' | 'activity'>('settle');
  const [composerOpen, setComposerOpen] = useState(false);
  const [entryMode, setEntryMode] = useState<'manual' | 'ai'>('manual');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currencyOverride, setCurrencyOverride] = useState('');
  const [payerOverride, setPayerOverride] = useState('');
  const [participantsByTrip, setParticipantsByTrip] = useState<Record<string, string[]>>({});
  const [aiText, setAiText] = useState('');
  const [receipt, setReceipt] = useState<ReceiptDraft>();
  const [expandedExpenseId, setExpandedExpenseId] = useState<string>();
  const [busyAction, setBusyAction] = useState<'parse' | 'save' | 'receipt'>();
  const [busySettlementId, setBusySettlementId] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [aiNotice, setAiNotice] = useState<string>();

  const currency = currencyOverride || activeTrip?.homeCurrency || 'HKD';
  const payerUserId = members.some(({ userId }) => userId === payerOverride) ? payerOverride : currentUserId;
  const participantIds = activeTrip
    ? participantsByTrip[activeTrip.id] ?? members.map(({ userId }) => userId)
    : [];
  const names = useMemo(() => new Map(ledgerMembers.map(({ userId, displayName }) => [userId, displayName])), [ledgerMembers]);
  const memberById = useMemo(() => new Map(ledgerMembers.map((member) => [member.userId, member])), [ledgerMembers]);
  const memberIds = useMemo(() => ledgerMembers.map(({ userId }) => userId), [ledgerMembers]);
  const currencyOptions = getCurrencyOptions(locale === 'en');
  const darkMode = theme.background === '#0C1924';
  const positiveColor = darkMode ? '#69D4BC' : '#087F6A';
  const dangerColor = darkMode ? '#FF9B96' : '#B4413E';
  const linkColor = darkMode ? '#8DD8FF' : '#1B70A6';

  const balanceSnapshots = useMemo<BalanceSnapshot[]>(() => {
    const gross = calculateBalancesByCurrency(expenses, memberIds);
    const outstanding = calculateOutstandingBalancesByCurrency(expenses, settlements, memberIds);
    const outstandingByCurrency = new Map(outstanding.map((item) => [item.currency, item.balances]));
    return gross.map(({ currency: balanceCurrency, balances }) => ({
      currency: balanceCurrency,
      outstandingTransfers: minimizeSettlementTransfers(outstandingByCurrency.get(balanceCurrency) ?? balances),
    }));
  }, [expenses, settlements, memberIds]);

  const pendingTransfers = balanceSnapshots.flatMap(({ currency: itemCurrency, outstandingTransfers }) =>
    outstandingTransfers.map((transfer) => ({ ...transfer, currency: itemCurrency })),
  );
  const myPendingTransfers = pendingTransfers.filter(({ fromParticipantId }) => fromParticipantId === currentUserId);
  const myIncomingTransfers = pendingTransfers.filter(({ toParticipantId }) => toParticipantId === currentUserId);

  function chooseEntryMode(mode: 'ai' | 'manual') {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setEntryMode(mode);
  }

  function toggleComposer() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setComposerOpen((open) => !open);
    setFormError(undefined);
    setSuccess(undefined);
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
    setBusyAction('save');
    setFormError(undefined);
    setSuccess(undefined);
    try {
      const totalMinor = parseAmountToMinor(amount, currency);
      const result = await addEqualExpense({
        title,
        currency: currency.toUpperCase(),
        totalMinor,
        payerUserId,
        participantUserIds: participantIds,
        receipt,
      });
      setTitle('');
      setAmount('');
      setAiText('');
      setReceipt(undefined);
      setAiNotice(undefined);
      setComposerOpen(false);
      setActiveView('activity');
      setSuccess(result.receiptError
        ? tx('支出已保存，但小票上传失败；可在支出详情中重新添加。', 'Expense saved, but the receipt upload failed. Add it again from the expense details.')
        : tx('支出已保存，分摊和结算待办已更新。', 'Expense saved. Shares and settlement tasks are updated.'));
    } catch (caught) {
      setFormError(toUserMessage(caught, tx('无法保存支出，请稍后重试。', 'Could not save the expense. Please try again.')));
    } finally {
      setBusyAction(undefined);
    }
  }

  async function completeTransfer(transfer: SettlementTransfer & { currency: string }) {
    const transferKey = `${transfer.currency}-${transfer.fromParticipantId}-${transfer.toParticipantId}`;
    setBusySettlementId(transferKey);
    setFormError(undefined);
    setSuccess(undefined);
    try {
      await markSettlement({
        toUserId: transfer.toParticipantId,
        currency: transfer.currency,
        amountMinor: transfer.amountMinor,
      });
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
      title={activeTrip ? tx(`${activeTrip.name} · 账本`, `${activeTrip.name} · ledger`) : tx('共享账本', 'Shared ledger')}
      subtitle={tx('先处理自己的结算，再查看消费凭证和全员进度。', 'Handle your own settlements first, then review receipts and group progress.')}>
      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
      {formError ? <InlineNotice tone="error">{formError}</InlineNotice> : null}
      {success ? <InlineNotice>{success}</InlineNotice> : null}
      {loading ? <InlineNotice>{tx('正在刷新账本…', 'Refreshing the ledger…')}</InlineNotice> : null}

      {activeTrip ? (
        <View style={styles.toolbar}>
          <View style={[styles.viewSwitch, { backgroundColor: theme.backgroundSelected }]}>
            <ViewSwitchButton selected={activeView === 'settle'} onPress={() => setActiveView('settle')}>
              {tx('结算', 'Settle')}
            </ViewSwitchButton>
            <ViewSwitchButton selected={activeView === 'activity'} onPress={() => setActiveView('activity')}>
              {tx('明细', 'Activity')}
            </ViewSwitchButton>
          </View>
          <Pressable accessibilityRole="button" onPress={toggleComposer} style={({ pressed }) => [styles.quickAddButton, pressed && styles.pressed]}>
            <ThemedText type="smallBold" style={styles.quickAddText}>
              {composerOpen ? tx('收起', 'Close') : tx('记一笔', 'Add expense')}
            </ThemedText>
          </Pressable>
        </View>
      ) : null}

      {activeTrip && composerOpen ? (
        <ExpenseComposer
          themeSurface={theme.backgroundElement}
          themeSelected={theme.backgroundSelected}
          dangerColor={dangerColor}
          tx={tx}
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
          currencyOptions={currencyOptions}
          setCurrencyOverride={setCurrencyOverride}
          members={members}
          payerUserId={payerUserId}
          setPayerOverride={setPayerOverride}
          participantIds={participantIds}
          toggleParticipant={toggleParticipant}
          receipt={receipt}
          setReceipt={setReceipt}
          pickReceipt={pickReceipt}
          submitExpense={submitExpense}
        />
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
          busySettlementId={busySettlementId}
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
  currencyOptions: { label: string; value: string }[];
  setCurrencyOverride: (value: string) => void;
  members: TripMember[];
  payerUserId: string;
  setPayerOverride: (value: string) => void;
  participantIds: string[];
  toggleParticipant: (userId: string) => void;
  receipt?: ReceiptDraft;
  setReceipt: (receipt?: ReceiptDraft) => void;
  pickReceipt: (source: 'camera' | 'library') => Promise<void>;
  submitExpense: () => Promise<void>;
}) {
  const { tx } = props;
  return (
    <View style={[styles.composer, { backgroundColor: props.themeSurface }]}>
      <View style={styles.composerHeading}>
        <ThemedText style={styles.sectionTitle}>{tx('新增支出', 'New expense')}</ThemedText>
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
            placeholder={tx('例如：晚餐 860 港币，小王付的，三个人均分', 'For example: Dinner was HKD 860, paid by Sam and split three ways')}
            multiline
            numberOfLines={3}
            maxLength={500}
            style={styles.multiline}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {tx('AI 只生成草稿；金额、付款人和分摊成员仍由你确认。', 'AI only creates a draft. You still confirm the amount, payer, and participants.')}
          </ThemedText>
          <ActionButton busy={props.busyAction === 'parse'} disabled={!props.aiText.trim() || Boolean(props.busyAction)} onPress={() => void props.parseWithAi()}>
            {tx('生成草稿', 'Create draft')}
          </ActionButton>
          <VoiceExpenseInput disabled={Boolean(props.busyAction)} tx={tx} onAudioReady={props.parseVoiceExpense} />
        </View>
      ) : (
        <View style={styles.formGroup}>
          {props.aiNotice ? <InlineNotice>{props.aiNotice}</InlineNotice> : null}
          <FormField label={tx('支出内容', 'Expense')} value={props.title} onChangeText={props.setTitle} placeholder={tx('例如：晚餐', 'For example: Dinner')} />
          <View style={styles.amountRow}>
            <View style={styles.grow}>
              <FormField label={tx('金额', 'Amount')} value={props.amount} onChangeText={props.setAmount} keyboardType="decimal-pad" placeholder="860.00" />
            </View>
            <View style={styles.currencyField}>
              <SelectionField label={tx('币种', 'Currency')} value={props.currency} options={props.currencyOptions} onChange={props.setCurrencyOverride} />
            </View>
          </View>
          <FieldGroup label={tx('谁付款？', 'Who paid?')}>
            {props.members.map((member) => (
              <MemberChoice key={member.userId} member={member} selected={props.payerUserId === member.userId} role="radio" onPress={() => props.setPayerOverride(member.userId)} />
            ))}
          </FieldGroup>
          <FieldGroup label={tx('谁参与分摊？', 'Who shares it?')}>
            {props.members.map((member) => (
              <MemberChoice key={member.userId} member={member} selected={props.participantIds.includes(member.userId)} onPress={() => props.toggleParticipant(member.userId)} />
            ))}
          </FieldGroup>
          <View style={styles.receiptGroup}>
            <View style={styles.receiptCopy}>
              <ThemedText type="smallBold">{tx('小票（可选）', 'Receipt (optional)')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{tx('拍照或从相册选择，最大 10 MB。', 'Take a photo or choose from your library, up to 10 MB.')}</ThemedText>
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
            disabled={Boolean(props.busyAction) || !props.title.trim() || !props.amount.trim() || props.participantIds.length === 0 || !props.payerUserId}
            onPress={() => void props.submitExpense()}>
            {tx('保存并更新结算', 'Save and update settlements')}
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
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: props.disabled || processing, busy: processing }}
        disabled={props.disabled || processing}
        onPress={() => void (state.isRecording ? stopAndParse() : startRecording())}
        style={({ pressed }) => [styles.voiceButton, state.isRecording && styles.voiceButtonRecording, pressed && styles.pressed, (props.disabled || processing) && styles.disabled]}>
        <ThemedText type="smallBold" style={styles.voiceButtonText}>
          {processing
            ? props.tx('正在理解语音…', 'Understanding audio…')
            : state.isRecording
              ? props.tx(`结束并生成草稿 · ${Math.round(state.durationMillis / 1000)}s`, `Stop and create draft · ${Math.round(state.durationMillis / 1000)}s`)
              : props.tx('语音记账', 'Record expense')}
        </ThemedText>
      </Pressable>
      <ThemedText type="small" themeColor="textSecondary">{props.tx('建议控制在 60 秒内；录音仅用于本次解析，不会保存。', 'Keep it under 60 seconds. The recording is processed once and not stored.')}</ThemedText>
      {voiceError ? <InlineNotice tone="error">{voiceError}</InlineNotice> : null}
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
  busySettlementId?: string;
  themeSelected: string;
  positiveColor: string;
  dangerColor: string;
  linkColor: string;
  completeTransfer: (transfer: SettlementTransfer & { currency: string }) => Promise<void>;
  undoTransfer: (settlement: Settlement) => Promise<void>;
}) {
  const { tx } = props;
  const mySettlements = props.settlements.filter((settlement) =>
    settlement.fromUserId === props.currentUserId || settlement.toUserId === props.currentUserId,
  );

  return (
    <View style={styles.workspace}>
      <View style={styles.personalSummary}>
        <View style={styles.summaryHeading}>
          <ThemedText style={styles.sectionTitle}>{tx('我的结算', 'My settlements')}</ThemedText>
          <ThemedText themeColor="textSecondary">
            {props.myPendingTransfers.length > 0
              ? tx(`还有 ${props.myPendingTransfers.length} 笔需要转出`, `${props.myPendingTransfers.length} payment${props.myPendingTransfers.length === 1 ? '' : 's'} to send`)
              : tx('你没有待转出的款项', 'You have nothing left to send')}
          </ThemedText>
        </View>
        {props.balanceSnapshots.length === 0 ? (
          <ThemedText themeColor="textSecondary">{tx('记录第一笔共同支出后，这里会生成结算待办。', 'Add the first shared expense to create settlement tasks.')}</ThemedText>
        ) : props.balanceSnapshots.map((snapshot) => {
          const pendingOut = sumTransfers(snapshot.outstandingTransfers, 'from', props.currentUserId);
          const pendingIn = sumTransfers(snapshot.outstandingTransfers, 'to', props.currentUserId);
          const sent = sumSettlements(props.settlements, snapshot.currency, 'from', props.currentUserId);
          const received = sumSettlements(props.settlements, snapshot.currency, 'to', props.currentUserId);
          return (
            <View key={snapshot.currency} style={styles.personalCurrencyRow}>
              <ThemedText type="smallBold" style={[styles.currencyCode, { color: props.positiveColor }]}>{snapshot.currency}</ThemedText>
              <Metric label={tx('待转出', 'To send')} value={formatMinorAmount(pendingOut, snapshot.currency)} color={props.dangerColor} />
              <Metric label={tx('已转出', 'Sent')} value={formatMinorAmount(sent, snapshot.currency)} />
              <Metric label={tx('待收款', 'To receive')} value={formatMinorAmount(pendingIn, snapshot.currency)} />
              <Metric label={tx('已收款', 'Received')} value={formatMinorAmount(received, snapshot.currency)} color={props.positiveColor} />
            </View>
          );
        })}
      </View>

      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeading}>
          <ThemedText style={styles.sectionTitle}>{tx('我的待办', 'My tasks')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{tx('只有付款人本人可以标记自己的转账。', 'Only the sender can mark their own payment as sent.')}</ThemedText>
        </View>
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
          return (
            <View key={key} style={styles.transferRow}>
              <MemberAvatar avatarUrl={recipient?.avatarUrl} displayName={recipient?.displayName ?? tx('同行者', 'Traveller')} size={42} />
              <View style={styles.transferCopy}>
                <ThemedText type="smallBold">{tx(`转给 ${props.names.get(transfer.toParticipantId) ?? '同行者'}`, `Pay ${props.names.get(transfer.toParticipantId) ?? 'Traveller'}`)}</ThemedText>
                <ThemedText style={styles.transferAmount}>{formatMinorAmount(transfer.amountMinor, transfer.currency)}</ThemedText>
              </View>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: false, busy: props.busySettlementId === key }}
                disabled={Boolean(props.busySettlementId)}
                onPress={() => void props.completeTransfer(transfer)}
                style={({ pressed }) => [styles.markPaidButton, pressed && styles.pressed, Boolean(props.busySettlementId) && styles.disabled]}>
                <ThemedText type="smallBold" style={styles.quickAddText}>{tx('标记已转账', 'Mark sent')}</ThemedText>
              </Pressable>
            </View>
          );
        })}
      </View>

      {mySettlements.length > 0 ? (
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeading}>
            <ThemedText style={styles.sectionTitle}>{tx('已完成', 'Completed')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{tx('如果误标，付款人可以恢复为未转账。', 'The sender can undo an accidental status change.')}</ThemedText>
          </View>
          {mySettlements.map((settlement) => {
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
          })}
        </View>
      ) : null}

      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeading}>
          <ThemedText style={styles.sectionTitle}>{tx('全员结算', 'Group settlement')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{tx('清楚显示每个人待转出、已转出、待收款和已收款。', 'See what every traveller needs to send, has sent, expects, and has received.')}</ThemedText>
        </View>
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
      </View>
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
        <ThemedText themeColor="textSecondary">{tx('点击“记一笔”添加共同消费和小票。', 'Tap “Add expense” to record a shared cost and receipt.')}</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeading}>
        <ThemedText style={styles.sectionTitle}>{tx('消费明细', 'Expense activity')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{tx('每笔支出保留付款人、分摊和小票凭证。', 'Every expense keeps its payer, split, and receipt evidence.')}</ThemedText>
      </View>
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
                {(expense.receipts?.length ?? 0) > 0 ? <ThemedText type="small" style={{ color: props.positiveColor }}>{tx('有小票', 'Receipt')}</ThemedText> : null}
              </View>
            </Pressable>
            {expanded ? (
              <View style={styles.expenseDetails}>
                <View style={styles.detailLine}><ThemedText type="smallBold">{tx('分摊', 'Split')}</ThemedText><ThemedText type="small" themeColor="textSecondary" style={styles.grow}>{shareText}</ThemedText></View>
                <View style={styles.sharePeople}>{expense.shares.map((share) => { const member = props.memberById.get(share.userId); return <View key={share.userId} style={styles.sharePerson}><MemberAvatar avatarUrl={member?.avatarUrl} displayName={member?.displayName ?? tx('同行者', 'Traveller')} size={30} /><ThemedText type="small" style={styles.grow}>{member?.displayName ?? tx('同行者', 'Traveller')}</ThemedText><ThemedText type="smallBold">{formatMinorAmount(share.amountMinor, expense.currency)}</ThemedText></View>; })}</View>
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

const styles = StyleSheet.create({
  workspace: { gap: 30 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  viewSwitch: { flexDirection: 'row', padding: 4, borderRadius: 14, flex: 1, maxWidth: 320 },
  viewSwitchButton: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingHorizontal: 14 },
  viewSwitchButtonActive: { backgroundColor: '#087F6A' },
  viewSwitchTextActive: { color: '#FFFFFF' },
  quickAddButton: { minHeight: 48, minWidth: 104, alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingHorizontal: 18, backgroundColor: '#087F6A' },
  quickAddText: { color: '#FFFFFF' },
  composer: { gap: 20, borderRadius: 16, padding: 20, shadowColor: '#15344A', shadowOpacity: 0.1, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  composerHeading: { gap: 12 },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  formGroup: { gap: 16 },
  amountRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-end' },
  currencyField: { width: 116 },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  voiceGroup: { gap: 8 },
  voiceButton: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, backgroundColor: '#1B70A6' },
  voiceButtonRecording: { backgroundColor: '#B4413E' },
  voiceButtonText: { color: '#FFFFFF' },
  fieldGroup: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
  currencyCode: { minWidth: 42, paddingBottom: 2 },
  metric: { minWidth: 94, flexGrow: 1, gap: 2 },
  sectionBlock: { gap: 0 },
  sectionHeading: { gap: 4, paddingBottom: 10 },
  transferRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#AFCACA' },
  transferCopy: { gap: 2, flex: 1 },
  transferAmount: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  markPaidButton: { minHeight: 44, minWidth: 112, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingHorizontal: 14, backgroundColor: '#087F6A' },
  completedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#AFCACA' },
  textButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  quietEmpty: { gap: 4, paddingVertical: 22, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#AFCACA' },
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
  detailLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  sharePeople: { gap: 6 }, sharePerson: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 10 },
  receiptGallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  receiptLarge: { width: 160, height: 190, borderRadius: 12, backgroundColor: '#D9EEEA' },
  grow: { flex: 1 },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.5 },
});
