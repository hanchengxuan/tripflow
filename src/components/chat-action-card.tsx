import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionButton, InlineNotice } from '@/components/form-controls';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { newPlanFromAction, planChangeFromAction, planTimeZone, type TripChatProposal } from '@/features/ai/trip-chat';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useMvp } from '@/features/mvp/mvp-provider';
import { useTheme } from '@/hooks/use-theme';
import { formatZonedDateTimeRange } from '@/lib/trip-time';
import { toUserMessage } from '@/lib/user-error';

const icons: Record<TripChatProposal['action']['type'], SymbolViewProps['name']> = {
  update_plan: { ios: 'pencil', android: 'edit', web: 'edit' },
  add_plan: { ios: 'plus', android: 'add', web: 'add' },
  add_expense: { ios: 'yensign.circle', android: 'payments', web: 'payments' },
};

/** One proposal from 小途: a visual before → after with an explicit confirm. Status lives with the conversation so reopening keeps it. */
export function ChatActionCard({ proposal, onStatus }: { proposal: TripChatProposal; onStatus: (status: TripChatProposal['status']) => void }) {
  const theme = useTheme();
  const router = useRouter();
  const { languageTag, locale, tx } = useI18n();
  const { activeTrip, itineraryItems, members, currentUserId, saveItineraryItem, addItineraryItem } = useMvp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  if (!activeTrip) return null;

  const { action } = proposal;
  const role = members.find(({ userId }) => userId === currentUserId)?.role;
  const canEditPlans = role === 'owner' || role === 'editor';
  const nameOf = (userId: string) => members.find((member) => member.userId === userId)?.displayName ?? tx('同行者', 'Traveller');
  const range = (startsAt: string, endsAt: string | undefined, timeZone: string) => formatZonedDateTimeRange(startsAt, endsAt, languageTag, timeZone);

  let heading = '';
  let before: string | undefined;
  let after: string | undefined;
  let confirmLabel = tx('确认', 'Confirm');
  let run: (() => Promise<void>) | undefined;
  let blocked: string | undefined;

  if (action.type === 'update_plan') {
    const item = itineraryItems.find(({ id }) => id === action.itemId);
    const original = proposal.before ?? item;
    heading = original?.title ?? tx('安排', 'Plan');
    if (!item || !original) {
      blocked = tx('这项安排已不存在。', 'This plan no longer exists.');
    } else {
      try {
        const timeZone = planTimeZone(item, activeTrip);
        const next = planChangeFromAction(action, { ...item, ...original }, activeTrip);
        before = [action.title ? original.title : undefined, action.startLocal || action.endLocal ? range(original.startsAt, original.endsAt, timeZone) : undefined].filter(Boolean).join(' · ');
        after = [action.title ? next.title : undefined, action.startLocal || action.endLocal ? range(next.startsAt, next.endsAt, timeZone) : undefined].filter(Boolean).join(' · ');
        run = () => saveItineraryItem({
          itemId: item.id, title: next.title, startsAt: next.startsAt, endsAt: next.endsAt,
          locationLabel: item.locationLabel, googlePlaceId: item.googlePlaceId, destination: item.destination,
        });
      } catch (caught) {
        blocked = toUserMessage(caught, tx('这个时间无效。', 'That time is not valid.'), locale);
      }
    }
    if (!canEditPlans) blocked = tx('只有可编辑成员能修改。', 'Only editors can change plans.');
  } else if (action.type === 'add_plan') {
    const plan = newPlanFromAction(action, activeTrip);
    heading = action.title;
    after = [range(plan.startsAt, plan.endsAt, activeTrip.defaultTimeZone), action.place].filter(Boolean).join(' · ');
    confirmLabel = tx('添加', 'Add');
    run = () => addItineraryItem(plan);
    if (action.kind === 'lodging' && !action.place) blocked = tx('住宿需要地点，告诉小途酒店地址吧。', 'A stay needs a place. Tell Tabi the hotel address.');
    if (!canEditPlans) blocked = tx('只有可编辑成员能添加。', 'Only editors can add plans.');
  } else {
    heading = action.title;
    after = `${action.currency} ${action.amount}`;
    before = [
      action.payerUserId ? tx(`${nameOf(action.payerUserId)} 付款`, `Paid by ${nameOf(action.payerUserId)}`) : undefined,
      action.participantUserIds ? tx(`${action.participantUserIds.length} 人分摊`, `Split ${action.participantUserIds.length} ways`) : undefined,
    ].filter(Boolean).join(' · ') || undefined;
    confirmLabel = tx('去记账', 'Open ledger');
    run = async () => {
      router.push({
        pathname: '/ledger',
        params: {
          chatDraft: JSON.stringify({
            title: action.title,
            amount: action.amount,
            currency: action.currency,
            payerUserId: action.payerUserId ?? currentUserId,
            participantUserIds: action.participantUserIds ?? members.map(({ userId }) => userId),
            confidence: 1,
            warnings: [],
          }),
        },
      });
    };
  }

  const confirm = async () => {
    if (!run) return;
    setBusy(true);
    setError(undefined);
    try {
      await run();
      onStatus(action.type === 'add_expense' ? 'opened' : 'saved');
    } catch (caught) {
      setError(toUserMessage(caught, tx('没能保存，请稍后重试。', 'Could not save. Try again later.'), locale));
    } finally {
      setBusy(false);
    }
  };

  const done = proposal.status !== 'pending';
  const isExpense = action.type === 'add_expense';
  return (
    <View style={[styles.card, { borderColor: done ? theme.accent : theme.border, backgroundColor: theme.backgroundElement }]}>
      <View style={styles.headingRow}>
        <View style={[styles.icon, { backgroundColor: theme.accentSoft }]}>
          <SymbolView name={icons[action.type]} size={16} tintColor={theme.accent} />
        </View>
        <ThemedText type="smallBold" style={styles.grow} numberOfLines={2}>{heading}</ThemedText>
      </View>
      {before && !isExpense ? <ThemedText type="small" themeColor="textSecondary" style={styles.struck}>{before}</ThemedText> : null}
      {after ? <ThemedText type={isExpense ? 'subtitle' : 'smallBold'} style={{ color: theme.accent }}>{isExpense ? after : `→ ${after}`}</ThemedText> : null}
      {before && isExpense ? <ThemedText type="small" themeColor="textSecondary">{before}</ThemedText> : null}
      {blocked ? <ThemedText type="small" themeColor="textSecondary">{blocked}</ThemedText> : null}
      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
      {done ? (
        <ThemedText type="smallBold" style={{ color: theme.accent }}>✓ {proposal.status === 'opened' ? tx('已打开记账', 'Opened in ledger') : tx('已保存', 'Saved')}</ThemedText>
      ) : (
        <ActionButton tone="primary" busy={busy} disabled={Boolean(blocked) || !run} onPress={() => void confirm()}>{confirmLabel}</ActionButton>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.xs },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  icon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1 },
  struck: { textDecorationLine: 'line-through' },
});
