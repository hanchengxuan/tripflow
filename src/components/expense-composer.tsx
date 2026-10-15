import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Chevron } from '@/components/chevron';
import { ExpenseQuickFill } from '@/components/expense-quick-fill';
import { ActionButton, ChoiceChip, FormField, InlineNotice } from '@/components/form-controls';
import { SelectionField } from '@/components/selection-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { currencyAmountPlaceholder, convertMinorAmount, formatMinorAmount, parseAmountToMinor, parseExchangeRate } from '@/domain/ledger';
import type { TripMember } from '@/domain/models';
import type { ExchangeRateLoadState } from '@/features/currency/use-exchange-rate';
import { defaultAllocationValueFor } from '@/features/ledger/default-allocation';
import { useTheme } from '@/hooks/use-theme';

export type ReceiptDraft = {
  uri: string;
  base64?: string | null;
  mimeType?: string | null;
  fileSize?: number;
};

export function ExpenseComposer(props: {
  themeSelected: string;
  dangerColor: string;
  tx: (zh: string, en: string) => string;
  editing: boolean;
  itineraryItemId: string;
  itineraryOptions: { value: string; label: string }[];
  setItineraryItemId: (value: string) => void;
  aiText: string;
  setAiText: (value: string) => void;
  parseWithAi: () => Promise<void>;
  parseVoiceExpense: (audioBase64: string, audioMimeType: string) => Promise<void>;
  scanReceipt: () => Promise<void>;
  busyAction?: 'parse' | 'save' | 'receipt';
  aiNotice?: string;
  formError?: string;
  title: string;
  setTitle: (value: string) => void;
  amount: string;
  setAmount: (value: string) => void;
  currency: string;
  baseCurrency: string;
  exchangeRate: string;
  exchangeRateSource: string;
  exchangeRateState: ExchangeRateLoadState;
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
  submitExpense: () => Promise<void>;
}) {
  const { tx } = props;
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 520;
  const [showAdvanced, setShowAdvanced] = useState(false);
  return (
    <View style={styles.composer}>
      <ExpenseQuickFill
        text={props.aiText}
        onChangeText={props.setAiText}
        onFill={props.parseWithAi}
        onAudioReady={props.parseVoiceExpense}
        onScanReceipt={props.scanReceipt}
        busy={Boolean(props.busyAction)}
        processing={props.busyAction === 'parse'}
        tx={tx}
      />

      <View style={styles.formGroup}>
          {props.aiNotice ? <InlineNotice>{props.aiNotice}</InlineNotice> : null}
          <FormField label={tx('支出内容', 'Expense')} value={props.title} onChangeText={props.setTitle} placeholder={tx('例如：晚餐', 'For example: Dinner')} />
          <View style={[styles.amountRow, compact && styles.amountRowCompact]}>
            <View style={[styles.amountField, compact && styles.stackedField]}>
              <FormField prominent label={tx('金额', 'Amount')} value={props.amount} onChangeText={props.setAmount} keyboardType="decimal-pad" placeholder={currencyAmountPlaceholder(props.currency)} />
            </View>
            <View style={[styles.currencyField, compact && styles.currencyFieldCompact]}>
              <SelectionField prominent label={tx('付款币种', 'Payment currency')} value={props.currency} options={props.currencyOptions} onChange={props.setCurrencyOverride} />
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
                {!props.editing ? (
                  <ThemedText
                    type="small"
                    themeColor={props.exchangeRateState.status === 'error' ? undefined : 'textSecondary'}
                    style={props.exchangeRateState.status === 'error' ? { color: props.dangerColor } : styles.exchangeRateMeta}>
                    {props.exchangeRateSource === 'manual'
                      ? tx('已手动调整', 'Adjusted manually')
                      : props.exchangeRateState.status === 'loading'
                        ? tx('正在获取最新工作日汇率…', 'Fetching the latest working-day rate…')
                        : props.exchangeRateState.status === 'success'
                          ? props.exchangeRateState.cached
                            ? tx(`使用缓存汇率 · ${props.exchangeRateState.date ?? ''}`, `Using cached rate · ${props.exchangeRateState.date ?? ''}`)
                            : tx(`已自动填入 · ${props.exchangeRateState.date ?? ''}`, `Filled automatically · ${props.exchangeRateState.date ?? ''}`)
                          : tx('自动获取失败，请手动填写。', 'Could not fetch a rate. Enter it manually.')}
                  </ThemedText>
                ) : null}
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
              <ChoiceChip key={member.userId} selected={props.selectedPayerIds.includes(member.userId)} onPress={() => props.togglePayer(member.userId)}>{member.displayName}</ChoiceChip>
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
                  placeholder={currencyAmountPlaceholder(props.currency, 0)}
                />
              ))}
            </View>
          ) : null}
          <FieldGroup label={tx('谁参与分摊？', 'Who shares it?')}>
            {props.members.map((member) => (
              <ChoiceChip key={member.userId} selected={props.participantIds.includes(member.userId)} onPress={() => props.toggleParticipant(member.userId)}>{member.displayName}</ChoiceChip>
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
                  placeholder={props.splitMode === 'exact' ? currencyAmountPlaceholder(props.currency, 0) : props.splitMode === 'percentage' ? '50' : '1'}
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
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showAdvanced }}
            onPress={() => setShowAdvanced((current) => !current)}
            style={({ pressed }) => [styles.advancedDisclosure, { borderTopColor: theme.border }, pressed && styles.pressed]}>
            <ThemedText type="smallBold" style={styles.grow}>{tx('更多选项', 'More options')}</ThemedText>
            <Chevron color={theme.textSecondary} direction={showAdvanced ? 'down' : 'right'} />
          </Pressable>
          {showAdvanced ? (
            <View style={styles.advancedFields}>
              <SelectionField
                label={tx('关联安排（可选）', 'Link to a plan (optional)')}
                value={props.itineraryItemId}
                options={props.itineraryOptions}
                onChange={props.setItineraryItemId}
              />
              <View style={styles.receiptGroup}>
              <View style={styles.receiptCopy}>
                <ThemedText type="smallBold">{tx('小票（可选）', 'Receipt (optional)')}</ThemedText>
              </View>
            {props.receipt ? (
              <View style={styles.receiptPreviewRow}>
                <Image accessible accessibilityLabel={tx('待上传的小票预览', 'Receipt preview awaiting upload')} source={props.receipt.uri} style={[styles.receiptPreview, { backgroundColor: theme.backgroundSelected }]} contentFit="contain" />
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
            </View>
          ) : null}
          {props.formError ? <InlineNotice tone="error">{props.formError}</InlineNotice> : null}
          <ActionButton
            busy={props.busyAction === 'save'}
            disabled={Boolean(props.busyAction)}
            onPress={() => void props.submitExpense()}>
            {props.editing ? tx('保存修改', 'Save changes') : tx('保存支出', 'Save expense')}
          </ActionButton>
        </View>
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

const styles = StyleSheet.create({
  composer: { gap: Spacing.lg },
  formGroup: { gap: 16 },
  amountField: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  stackedField: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%' },
  amountRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-end' },
  amountRowCompact: { flexDirection: 'column', alignItems: 'stretch', gap: Spacing.md },
  currencyField: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  currencyFieldCompact: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%' },
  conversionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12, borderRadius: 12, padding: 12 },
  exchangeRateMeta: { marginTop: 4 },
  conversionPreview: { flexGrow: 1, flexBasis: 150, gap: 2, paddingBottom: 10 },
  advancedDisclosure: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth },
  advancedFields: { gap: 16 },
  fieldGroup: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  splitFields: { gap: 10, padding: 12, borderRadius: 12 },
  splitPreview: { gap: 4, padding: 12, borderRadius: 12 },
  receiptGroup: { gap: 10, paddingTop: 4 },
  receiptCopy: { gap: 2 },
  receiptActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  secondaryAction: { minHeight: 44, flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 12 },
  receiptPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  receiptPreview: { width: 80, height: 80, borderRadius: 12 },
  textButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  grow: { flex: 1 },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.5 },
});
