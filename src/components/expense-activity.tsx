import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Fragment, useMemo } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { ListDivider, ListSurface } from '@/components/list-surface';
import { MemberAvatar } from '@/components/member-avatar';
import { ThemedText } from '@/components/themed-text';
import { itineraryKindSymbols } from '@/constants/options';
import { formatMinorAmount } from '@/domain/ledger';
import type { Expense, ItineraryItem, TripMember } from '@/domain/models';
import { useI18n } from '@/features/i18n/i18n-provider';
import { groupExpensesByDay } from '@/features/ledger/group-expenses-by-day';
import { useTheme } from '@/hooks/use-theme';

const receiptSymbol = { ios: 'receipt', android: 'receipt_long', web: 'receipt_long' } as const;
const settledSymbol = { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' } as const;
const attachmentSymbol = { ios: 'paperclip', android: 'attach_file', web: 'attach_file' } as const;

export function ExpenseActivity(props: {
  expenses: Expense[];
  itineraryItems: ItineraryItem[];
  timeZone: string;
  names: Map<string, string>;
  memberById: Map<string, TripMember>;
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
  const { tx, formatDate, formatDateTime } = useI18n();
  const theme = useTheme();
  const days = useMemo(() => groupExpensesByDay(props.expenses, props.timeZone), [props.expenses, props.timeZone]);
  const itemById = useMemo(() => new Map(props.itineraryItems.map((item) => [item.id, item])), [props.itineraryItems]);
  if (props.expenses.length === 0) {
    return (
      <View style={[styles.quietEmpty, { borderTopColor: theme.border }]}>
        <ThemedText style={styles.sectionTitle}>{tx('还没有支出', 'No expenses yet')}</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.activityWorkspace}>
      {days.map((day) => (
        <View key={day.date} style={styles.day}>
          <ThemedText type="small" themeColor="textMuted" style={styles.dayLabel}>
            {/* Noon UTC keeps the calendar date stable in every viewer time zone. */}
            {formatDate(`${day.date}T12:00:00Z`, { month: 'short', day: 'numeric', weekday: 'short', timeZone: 'UTC' })}
          </ThemedText>
          <ListSurface>
          {day.expenses.map((expense, index) => {
            const expanded = props.expandedExpenseId === expense.id;
            const linkedItem = expense.itineraryItemId ? itemById.get(expense.itineraryItemId) : undefined;
            const payerNames = expense.payers.map(({ userId }) => props.names.get(userId) ?? tx('同行者', 'Traveller')).join(tx('、', ', '));
            const amountText = formatMinorAmount(expense.totalMinor, expense.currency);
            const foreignBase = expense.baseCurrency && expense.baseCurrency !== expense.currency ? expense.baseCurrency : undefined;
            const hasReceipt = (expense.receipts?.length ?? 0) > 0;
            const shareText = expense.shares
              .map((share) => `${props.names.get(share.userId) ?? tx('同行者', 'Traveller')} ${formatMinorAmount(share.amountMinor, expense.currency)}`)
              .join(' · ');
            return (
              <Fragment key={expense.id}>
              {index > 0 ? <ListDivider /> : null}
              <View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  accessibilityLabel={[
                    expense.title,
                    expense.localTime,
                    tx(`${payerNames} 付款`, `Paid by ${payerNames}`),
                    amountText,
                    expense.settledAt ? tx('已结清', 'Settled') : tx('待结清', 'Unsettled'),
                    hasReceipt ? tx('有小票', 'Receipt') : '',
                  ].filter(Boolean).join(', ')}
                  onPress={() => props.setExpandedExpenseId(expanded ? undefined : expense.id)}
                  style={({ pressed }) => [styles.expenseSummary, pressed && styles.pressed]}>
                  <View style={[styles.kindIcon, { backgroundColor: theme.backgroundSelected }]}>
                    <SymbolView name={linkedItem ? itineraryKindSymbols[linkedItem.kind] : receiptSymbol} size={18} tintColor={theme.accentOnSoft} />
                  </View>
                  <View style={styles.grow}>
                    <ThemedText type="smallBold" numberOfLines={1}>{expense.title}</ThemedText>
                    <View style={styles.meta}>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.time}>{expense.localTime}</ThemedText>
                      <View style={styles.payers}>
                        {expense.payers.map(({ userId }) => {
                          const payer = props.memberById.get(userId);
                          return <MemberAvatar key={userId} avatarUrl={payer?.avatarUrl} displayName={payer?.displayName ?? props.names.get(userId) ?? tx('同行者', 'Traveller')} size={20} />;
                        })}
                      </View>
                    </View>
                  </View>
                  <View style={styles.expenseAmountBlock}>
                    <View style={styles.amountLine}>
                      {hasReceipt ? <SymbolView name={attachmentSymbol} size={14} tintColor={theme.textSecondary} /> : null}
                      <ThemedText type="smallBold">{amountText}</ThemedText>
                      {expense.settledAt ? <SymbolView name={settledSymbol} size={16} tintColor={props.positiveColor} /> : null}
                    </View>
                    {foreignBase ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        ≈ {formatMinorAmount(expense.baseAmountMinor ?? 0, foreignBase)}
                      </ThemedText>
                    ) : null}
                  </View>
                </Pressable>
                {expanded ? (
                  <View style={styles.expenseDetails}>
                    <View style={styles.detailLine}><ThemedText type="smallBold">{tx('付款', 'Paid by')}</ThemedText><ThemedText type="small" themeColor="textSecondary" style={styles.grow}>{payerNames}</ThemedText></View>
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
                          {linkedItem.title} · {formatDateTime(linkedItem.startsAt)}
                        </ThemedText>
                      </View>
                    ) : null}
                    <View style={styles.sharePeople}>{expense.shares.map((share) => { const member = props.memberById.get(share.userId); const status = props.settlementStatusByUser.get(share.userId); return <View key={share.userId} style={styles.sharePerson}><MemberAvatar avatarUrl={member?.avatarUrl} displayName={member?.displayName ?? tx('同行者', 'Traveller')} size={30} /><ThemedText type="small" style={styles.grow}>{member?.displayName ?? tx('同行者', 'Traveller')}</ThemedText><View style={styles.shareAmount}><ThemedText type="smallBold">{formatMinorAmount(share.amountMinor, expense.currency)}</ThemedText><ThemedText type="smallBold" style={status?.color ? { color: status.color } : undefined}>{status?.label ?? tx('待结算', 'Pending')}</ThemedText></View></View>; })}</View>
                    {hasReceipt ? (
                      <View style={styles.receiptGallery}>
                        {expense.receipts?.map((item, receiptIndex) => item.signedUrl ? (
                          <Pressable
                            key={item.id}
                            accessibilityRole="link"
                            accessibilityLabel={tx(`查看 ${expense.title} 的第 ${receiptIndex + 1} 张小票`, `View receipt ${receiptIndex + 1} for ${expense.title}`)}
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
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  quietEmpty: { gap: 4, paddingVertical: 22, borderTopWidth: StyleSheet.hairlineWidth },
  sectionTitle: { fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  activityWorkspace: { gap: 18 },
  day: { gap: 6 },
  dayLabel: { fontSize: 12, lineHeight: 17, fontWeight: '700', letterSpacing: 0.6, paddingHorizontal: 2 },
  kindIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  time: { fontVariant: ['tabular-nums'] },
  payers: { flexDirection: 'row', gap: 2 },
  amountLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  receiptActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  secondaryAction: { minHeight: 44, flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 12 },
  textButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  expenseSummary: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
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
