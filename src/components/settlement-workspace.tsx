import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { BalanceBar } from '@/components/balance-bar';
import { BottomSheet } from '@/components/bottom-sheet';
import { ActionButton, FormField, InlineNotice } from '@/components/form-controls';
import { ListDivider, ListRow, ListSurface } from '@/components/list-surface';
import { MemberAvatar } from '@/components/member-avatar';
import { SectionHeading } from '@/components/section-heading';
import { SelectionField } from '@/components/selection-field';
import { SettingsDivider, SettingsGroup, SettingsRow } from '@/components/settings-list';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { convertMinorAmount, currencyMinorDigits, formatMinorAmount, parseAmountToMinor, parseExchangeRate } from '@/domain/ledger';
import type { SettlementTransfer } from '@/domain/money';
import type { Settlement, TripMember } from '@/domain/models';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useTheme } from '@/hooks/use-theme';

export interface BalanceSnapshot {
  currency: string;
  outstandingTransfers: SettlementTransfer[];
}

export interface SettlementDraft {
  currency: string;
  amount: string;
  rate: string;
}

type Transfer = SettlementTransfer & { currency: string };
type Panel = 'currency' | 'completed' | 'group' | 'base';

export function transferKey(transfer: Transfer) {
  return `${transfer.currency}-${transfer.fromParticipantId}-${transfer.toParticipantId}`;
}

export function amountInputFromMinor(amountMinor: number, currency: string) {
  const digits = currencyMinorDigits(currency);
  return (amountMinor / 10 ** digits).toFixed(digits);
}

function sumTransfers(transfers: SettlementTransfer[], direction: 'from' | 'to', userId: string) {
  return transfers.reduce((sum, transfer) => {
    const matches = direction === 'from' ? transfer.fromParticipantId === userId : transfer.toParticipantId === userId;
    return matches ? sum + transfer.amountMinor : sum;
  }, 0);
}


/**
 * Settling up.
 *
 * The balance bar at the top is UI 2.0's and unchanged. Below it, what used to
 * be a wrap-flex row with a hand-rolled accent button and three things that
 * unfolded in place is now the vocabulary the rest of the product uses: tasks
 * are rows, and everything that needs more room opens a panel.
 *
 * Money keeps its direction. A row that is due states 待转 in `moneyOut`, one
 * owed to you states 待收 in `moneyIn`, and both say the word — the colour is
 * never the only carrier.
 */
export function SettlementWorkspace({
  balanceSnapshots,
  baseCurrency,
  baseCurrencyPanel,
  busySettlementId,
  completeTransfer,
  currencyOptions,
  currentUserId,
  hasCompleteConversions,
  memberById,
  myIncomingTransfers,
  myPendingTransfers,
  names,
  pendingTransfers,
  settlementDrafts,
  settlements,
  setSettlementDrafts,
  summaryTransfers,
  undoTransfer,
}: {
  balanceSnapshots: BalanceSnapshot[];
  baseCurrency: string;
  /** Opens the ledger's own currency setting. */
  baseCurrencyPanel: () => void;
  busySettlementId?: string;
  completeTransfer: (transfer: Transfer) => Promise<void>;
  currencyOptions: { label: string; value: string }[];
  currentUserId: string;
  hasCompleteConversions: boolean;
  memberById: Map<string, TripMember>;
  myIncomingTransfers: Transfer[];
  myPendingTransfers: Transfer[];
  names: Map<string, string>;
  pendingTransfers: Transfer[];
  settlementDrafts: Record<string, SettlementDraft>;
  settlements: Settlement[];
  setSettlementDrafts: React.Dispatch<React.SetStateAction<Record<string, SettlementDraft>>>;
  summaryTransfers: Transfer[];
  undoTransfer: (settlement: Settlement) => Promise<void>;
}) {
  const theme = useTheme();
  const { tx } = useI18n();
  const [panel, setPanel] = useState<Panel>();
  const [currencyKey, setCurrencyKey] = useState<string>();

  const mySettlements = settlements.filter(({ fromUserId, toUserId }) => fromUserId === currentUserId || toUserId === currentUserId);
  const pendingOut = sumTransfers(summaryTransfers, 'from', currentUserId);
  const pendingIn = sumTransfers(summaryTransfers, 'to', currentUserId);
  const currencyTransfer = myPendingTransfers.find((transfer) => transferKey(transfer) === currencyKey);
  const draftFor = (transfer: Transfer) =>
    settlementDrafts[transferKey(transfer)]
    ?? { currency: baseCurrency, amount: amountInputFromMinor(transfer.amountMinor, baseCurrency), rate: '1' };

  return (
    <View style={styles.workspace}>
      {balanceSnapshots.length === 0 ? (
        <ThemedText themeColor="textSecondary">
          {tx('记录第一笔共同支出后，这里会生成结算待办。', 'Add the first shared expense to create settlement tasks.')}
        </ThemedText>
      ) : (
        <View style={styles.summary}>
          <BalanceBar
            outLabel={tx('你要付 TO SEND', 'TO SEND')}
            outAmount={formatMinorAmount(pendingOut, baseCurrency)}
            outValue={pendingOut}
            inLabel={tx('该收 TO RECEIVE', 'TO RECEIVE')}
            inAmount={formatMinorAmount(pendingIn, baseCurrency)}
            inValue={pendingIn}
            footnote={tx(
              `净额 Net ${formatMinorAmount(pendingIn - pendingOut, baseCurrency)} · ${mySettlements.length} 笔已完成`,
              `Net ${formatMinorAmount(pendingIn - pendingOut, baseCurrency)} · ${mySettlements.length} completed`,
            )}
          />
          {!hasCompleteConversions ? (
            <InlineNotice>
              {tx('部分外币支出缺少汇率；上方仅汇总已换算金额。', 'Some foreign-currency expenses need a rate; the summary includes converted amounts only.')}
            </InlineNotice>
          ) : null}
        </View>
      )}

      {/* The heading says what the section is. The sentence explaining how the
          two tabs differ has gone the way of the ones on Plans and the map. */}
      <SectionHeading
        title={tx('我的待办', 'My tasks')}
        trailing={<ThemedText type="small" themeColor="textSecondary">{tx(`${myPendingTransfers.length} 笔`, `${myPendingTransfers.length}`)}</ThemedText>}
      />

      {myPendingTransfers.length === 0 ? (
        <View style={styles.empty}>
          <ThemedText type="smallBold">{tx('待转出已清空', 'Nothing to send')}</ThemedText>
          {myIncomingTransfers.length > 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {tx(`仍有 ${myIncomingTransfers.length} 笔款项待他人转给你。`, `${myIncomingTransfers.length} incoming payment${myIncomingTransfers.length === 1 ? '' : 's'} still pending.`)}
            </ThemedText>
          ) : null}
        </View>
      ) : (
        <SettingsGroup>
          {myPendingTransfers.map((transfer, index) => {
            const recipient = memberById.get(transfer.toParticipantId);
            const name = names.get(transfer.toParticipantId) ?? tx('同行者', 'Traveller');
            return (
              <View key={transferKey(transfer)}>
                {index > 0 ? <SettingsDivider /> : null}
                <SettingsRow
                  leading={<MemberAvatar avatarUrl={recipient?.avatarUrl} displayName={recipient?.displayName ?? name} size={38} />}
                  label={tx(`转给 ${name}`, `Pay ${name}`)}
                  value={formatMinorAmount(transfer.amountMinor, baseCurrency)}
                  valueColor={theme.moneyOut}
                  control={
                    <ActionButton
                      size="compact"
                      busy={busySettlementId === transferKey(transfer)}
                      disabled={Boolean(busySettlementId)}
                      onPress={() => void completeTransfer(transfer)}>
                      {tx('标记已转账', 'Mark sent')}
                    </ActionButton>
                  }
                />
              </View>
            );
          })}
        </SettingsGroup>
      )}

      {/* Three things that used to unfold in place. Each is a row that says how
          much is behind it and opens a panel. */}
      <SettingsGroup>
        {myPendingTransfers.length > 0 ? (
          <>
            <SettingsRow
              label={tx('用其他币种付款', 'Pay in another currency')}
              value={tx(`${myPendingTransfers.length} 笔`, `${myPendingTransfers.length}`)}
              onPress={() => { setCurrencyKey(transferKey(myPendingTransfers[0])); setPanel('currency'); }}
            />
            <SettingsDivider />
          </>
        ) : null}
        <SettingsRow
          label={tx('已完成', 'Completed')}
          value={tx(`${mySettlements.length} 笔`, `${mySettlements.length}`)}
          onPress={mySettlements.length > 0 ? () => setPanel('completed') : undefined}
        />
        <SettingsDivider />
        <SettingsRow
          label={tx('全员结算', 'Group settlement')}
          value={tx(`${names.size} 人 · ${balanceSnapshots.length} 种币种`, `${names.size} people · ${balanceSnapshots.length} currencies`)}
          onPress={balanceSnapshots.length > 0 ? () => setPanel('group') : undefined}
        />
        <SettingsDivider />
        {/* The ledger's own setting, where it belongs. It used to be a field on
            the Trips form, changeable long after the arithmetic depended on it. */}
        <SettingsRow label={tx('记账币种', 'Ledger currency')} value={baseCurrency} onPress={baseCurrencyPanel} />
      </SettingsGroup>

      <BottomSheet onDismiss={() => setPanel(undefined)} title={tx('用其他币种付款', 'Pay in another currency')} visible={panel === 'currency'}>
        <View style={styles.panel}>
          {myPendingTransfers.length > 1 ? (
            <SelectionField
              label={tx('这笔转账', 'Which payment')}
              value={currencyKey ?? ''}
              options={myPendingTransfers.map((transfer) => ({
                value: transferKey(transfer),
                label: `${tx('转给', 'Pay')} ${names.get(transfer.toParticipantId) ?? tx('同行者', 'Traveller')} · ${formatMinorAmount(transfer.amountMinor, baseCurrency)}`,
              }))}
              onChange={setCurrencyKey}
            />
          ) : null}
          {currencyTransfer ? (
            <>
              <SettlementPaymentEditor
                baseCurrency={baseCurrency}
                currencyOptions={currencyOptions}
                draft={draftFor(currencyTransfer)}
                setDraft={(next) => setSettlementDrafts((current) => ({ ...current, [transferKey(currencyTransfer)]: next }))}
                transfer={currencyTransfer}
              />
              <ActionButton
                busy={busySettlementId === transferKey(currencyTransfer)}
                onPress={() => { void completeTransfer(currencyTransfer); setPanel(undefined); }}>
                {tx('标记已转账', 'Mark sent')}
              </ActionButton>
            </>
          ) : null}
        </View>
      </BottomSheet>

      <BottomSheet onDismiss={() => setPanel(undefined)} title={tx('已完成', 'Completed')} visible={panel === 'completed'}>
        <ListSurface tone="subtle">
          {mySettlements.map((settlement, index) => {
            const sentByMe = settlement.fromUserId === currentUserId;
            const other = memberById.get(sentByMe ? settlement.toUserId : settlement.fromUserId);
            const name = names.get(sentByMe ? settlement.toUserId : settlement.fromUserId) ?? tx('同行者', 'Traveller');
            return (
              <View key={settlement.id}>
                {index > 0 ? <ListDivider /> : null}
                <ListRow
                  leading={<MemberAvatar avatarUrl={other?.avatarUrl} displayName={other?.displayName ?? name} size={34} />}
                  title={sentByMe ? tx(`已转给 ${name}`, `Sent to ${name}`) : tx(`已收到 ${name} 的转账`, `Received from ${name}`)}
                  subtitle={formatMinorAmount(settlement.amountMinor, settlement.currency)}
                  trailing={sentByMe ? (
                    <ActionButton
                      size="compact"
                      tone="secondary"
                      disabled={Boolean(busySettlementId)}
                      onPress={() => void undoTransfer(settlement)}>
                      {tx('恢复未转账', 'Mark unsent')}
                    </ActionButton>
                  ) : (
                    <ThemedText type="smallBold" style={{ color: theme.moneyIn }}>{tx('已收入', 'Received')}</ThemedText>
                  )}
                />
              </View>
            );
          })}
        </ListSurface>
      </BottomSheet>

      <BottomSheet onDismiss={() => setPanel(undefined)} title={tx('全员结算', 'Group settlement')} visible={panel === 'group'}>
        <View style={styles.panel}>
          {balanceSnapshots.map((snapshot) => (
            <View key={snapshot.currency} style={styles.group}>
              <View style={styles.groupHead}>
                <ThemedText type="small" themeColor="textMuted" style={styles.groupLabel}>{snapshot.currency}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{tx(`${names.size} 人`, `${names.size} people`)}</ThemedText>
              </View>
              <SettingsGroup>
                {[...names.entries()].map(([userId, displayName], index) => {
                  const member = memberById.get(userId);
                  const out = sumTransfers(snapshot.outstandingTransfers, 'from', userId);
                  const owed = sumTransfers(snapshot.outstandingTransfers, 'to', userId);
                  // One net figure per person, with the direction written out —
                  // not four equal-weight metrics, which is what the balance bar
                  // replaced at the top of this page.
                  const state = out > 0
                    ? { label: tx(`待转 ${formatMinorAmount(out, snapshot.currency)}`, `Owes ${formatMinorAmount(out, snapshot.currency)}`), color: theme.moneyOut }
                    : owed > 0
                    ? { label: tx(`待收 ${formatMinorAmount(owed, snapshot.currency)}`, `Owed ${formatMinorAmount(owed, snapshot.currency)}`), color: theme.moneyIn }
                    : { label: tx('已结清', 'Settled'), color: theme.textSecondary };
                  return (
                    <View key={userId}>
                      {index > 0 ? <SettingsDivider /> : null}
                      <SettingsRow
                        label={member?.archived ? tx(`${displayName} · 已离开行程`, `${displayName} · left trip`) : displayName}
                        leading={<MemberAvatar avatarUrl={member?.avatarUrl} displayName={displayName} size={32} />}
                        value={state.label}
                        valueColor={state.color}
                      />
                    </View>
                  );
                })}
              </SettingsGroup>
            </View>
          ))}

          {pendingTransfers.length > 0 ? (
            <View style={styles.group}>
              <ThemedText type="small" themeColor="textMuted" style={styles.groupLabel}>{tx('剩余转账路径', 'Remaining transfers')}</ThemedText>
              <SettingsGroup>
                {pendingTransfers.map((transfer, index) => (
                  <View key={transferKey(transfer)}>
                    {index > 0 ? <SettingsDivider /> : null}
                    <SettingsRow
                      label={`${names.get(transfer.fromParticipantId) ?? tx('同行者', 'Traveller')} → ${names.get(transfer.toParticipantId) ?? tx('同行者', 'Traveller')}`}
                      value={formatMinorAmount(transfer.amountMinor, transfer.currency)}
                    />
                  </View>
                ))}
              </SettingsGroup>
            </View>
          ) : balanceSnapshots.length > 0 ? (
            <InlineNotice>{tx('全部结清。', 'All settled.')}</InlineNotice>
          ) : null}
        </View>
      </BottomSheet>
    </View>
  );
}

function SettlementPaymentEditor({
  baseCurrency,
  currencyOptions,
  draft,
  setDraft,
  transfer,
}: {
  baseCurrency: string;
  currencyOptions: { label: string; value: string }[];
  draft: SettlementDraft;
  setDraft: (draft: SettlementDraft) => void;
  transfer: Transfer;
}) {
  const { tx } = useI18n();
  const { width } = useWindowDimensions();
  const compact = width < 520;
  const sameCurrency = draft.currency.toUpperCase() === baseCurrency.toUpperCase();

  function converted() {
    try {
      if (!draft.amount.trim()) return tx('会从待转余额中扣除实际折算金额。', 'The converted amount will be deducted from the balance due.');
      const rate = sameCurrency ? 1 : parseExchangeRate(draft.rate);
      const value = convertMinorAmount(parseAmountToMinor(draft.amount, draft.currency), draft.currency, baseCurrency, rate);
      return tx(
        `记入 ${baseCurrency}：${formatMinorAmount(value, baseCurrency)} · 待转 ${formatMinorAmount(transfer.amountMinor, baseCurrency)}`,
        `Books ${formatMinorAmount(value, baseCurrency)} in ${baseCurrency} · due ${formatMinorAmount(transfer.amountMinor, baseCurrency)}`,
      );
    } catch {
      return tx('请输入金额和有效汇率。', 'Enter an amount and a valid rate.');
    }
  }

  return (
    <View style={styles.editor}>
      <View style={[styles.editorRow, compact && styles.editorRowStacked]}>
        <View style={[styles.editorField, compact && styles.editorFieldStacked]}>
          <SelectionField
            label={tx('付款币种', 'Payment currency')}
            value={draft.currency}
            options={currencyOptions}
            onChange={(currency) => setDraft({ ...draft, currency, amount: '', rate: currency === baseCurrency ? '1' : draft.rate })}
          />
        </View>
        <View style={styles.editorField}>
          <FormField
            label={tx('实际转账金额', 'Amount sent')}
            value={draft.amount}
            onChangeText={(amount) => setDraft({ ...draft, amount })}
            keyboardType="decimal-pad"
            placeholder="0.00"
          />
        </View>
      </View>
      {!sameCurrency ? (
        <FormField
          label={tx(`汇率：1 ${draft.currency} = ? ${baseCurrency}`, `Rate: 1 ${draft.currency} = ? ${baseCurrency}`)}
          value={draft.rate}
          onChangeText={(rate) => setDraft({ ...draft, rate })}
          keyboardType="decimal-pad"
          placeholder="0.92"
        />
      ) : null}
      <ThemedText type="small" themeColor="textSecondary">{converted()}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  workspace: { gap: Spacing.md },
  summary: { gap: Spacing.sm, paddingVertical: Spacing['2xs'] },
  empty: { gap: Spacing['2xs'], paddingVertical: Spacing.lg },
  panel: { width: '100%', gap: Spacing.md },
  group: { gap: Spacing.xs },
  groupHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: Spacing.sm },
  groupLabel: { fontSize: 12, lineHeight: 17, fontWeight: '700', letterSpacing: 0.6, paddingHorizontal: Spacing['2xs'] },
  editor: { gap: Spacing.sm },
  editorRow: { flexDirection: 'row', gap: Spacing.sm },
  editorRowStacked: { flexDirection: 'column' },
  editorField: { flexGrow: 1, flexBasis: 150, minWidth: 0 },
  editorFieldStacked: { flexGrow: 0, flexBasis: 'auto' },
});
