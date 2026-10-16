import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionButton, InlineNotice } from '@/components/form-controls';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { itineraryKindLabels, itineraryKindLabelsEn } from '@/constants/options';
import { newPlanFromAction, planChangeFromAction, planTimeZone, type TripChatAction } from '@/features/ai/trip-chat';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useMvp } from '@/features/mvp/mvp-provider';
import { useTheme } from '@/hooks/use-theme';
import { formatZonedDateTimeRange } from '@/lib/trip-time';
import { toUserMessage } from '@/lib/user-error';

/** One proposal from the trip assistant, with a preview and an explicit confirm. */
export function ChatActionCard({ action }: { action: TripChatAction }) {
  const theme = useTheme();
  const router = useRouter();
  const { languageTag, locale, tx } = useI18n();
  const { activeTrip, itineraryItems, members, currentUserId, saveItineraryItem, addItineraryItem } = useMvp();
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<string>();
  if (!activeTrip) return null;

  const role = members.find(({ userId }) => userId === currentUserId)?.role;
  const canEditPlans = role === 'owner' || role === 'editor';
  const nameOf = (userId: string) => members.find((member) => member.userId === userId)?.displayName ?? tx('同行者', 'Traveller');
  const range = (startsAt: string, endsAt: string | undefined, timeZone: string) => formatZonedDateTimeRange(startsAt, endsAt, languageTag, timeZone);

  let title: string;
  let lines: string[] = [];
  let confirmLabel = tx('确认修改', 'Confirm');
  let run: (() => Promise<void>) | undefined;
  let blocked: string | undefined;

  if (action.type === 'update_plan') {
    const item = itineraryItems.find(({ id }) => id === action.itemId);
    title = tx(`修改「${item?.title ?? '安排'}」`, `Change “${item?.title ?? 'plan'}”`);
    if (!item) {
      blocked = tx('这项安排已不存在。', 'This plan no longer exists.');
    } else {
      try {
        const next = planChangeFromAction(action, item, activeTrip);
        const timeZone = planTimeZone(item, activeTrip);
        if (next.title !== item.title) lines.push(`${item.title} → ${next.title}`);
        if (action.startLocal || action.endLocal) lines.push(`${range(item.startsAt, item.endsAt, timeZone)} → ${range(next.startsAt, next.endsAt, timeZone)}`);
        run = () => saveItineraryItem({
          itemId: item.id, title: next.title, startsAt: next.startsAt, endsAt: next.endsAt,
          locationLabel: item.locationLabel, googlePlaceId: item.googlePlaceId, destination: item.destination,
        });
      } catch (caught) {
        blocked = toUserMessage(caught, tx('这个时间无效。', 'That time is not valid.'), locale);
      }
    }
    if (!canEditPlans) blocked = tx('只有可编辑成员能修改安排。', 'Only editors can change plans.');
  } else if (action.type === 'add_plan') {
    const plan = newPlanFromAction(action, activeTrip);
    const kindLabel = locale === 'zh-CN' ? itineraryKindLabels[action.kind] : itineraryKindLabelsEn[action.kind];
    title = tx(`新增${kindLabel}「${action.title}」`, `Add ${kindLabel.toLowerCase()} “${action.title}”`);
    lines = [range(plan.startsAt, plan.endsAt, activeTrip.defaultTimeZone), ...(action.place ? [action.place] : [])];
    confirmLabel = tx('确认添加', 'Add plan');
    run = () => addItineraryItem(plan);
    if (action.kind === 'lodging' && !action.place) blocked = tx('住宿需要地点，请在聊天里补充酒店地址。', 'A stay needs a place. Tell the assistant the hotel address.');
    if (!canEditPlans) blocked = tx('只有可编辑成员能添加安排。', 'Only editors can add plans.');
  } else {
    title = tx(`记一笔「${action.title}」`, `Record “${action.title}”`);
    lines = [
      `${action.currency} ${action.amount}`,
      ...(action.payerUserId ? [tx(`${nameOf(action.payerUserId)} 付款`, `Paid by ${nameOf(action.payerUserId)}`)] : []),
      ...(action.participantUserIds ? [tx(`分摊：${action.participantUserIds.map(nameOf).join('、')}`, `Split: ${action.participantUserIds.map(nameOf).join(', ')}`)] : []),
    ];
    confirmLabel = tx('去记账确认', 'Review in ledger');
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
    setState('busy');
    setError(undefined);
    try {
      await run();
      setState('done');
    } catch (caught) {
      setError(toUserMessage(caught, tx('没能保存，请稍后重试。', 'Could not save. Try again later.'), locale));
      setState('idle');
    }
  };

  return (
    <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold">{title}</ThemedText>
      {lines.map((line) => <ThemedText key={line} type="small" themeColor="textSecondary">{line}</ThemedText>)}
      {blocked ? <ThemedText type="small" themeColor="textSecondary">{blocked}</ThemedText> : null}
      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
      {state === 'done' ? (
        <ThemedText type="smallBold" style={{ color: theme.accent }}>{action.type === 'add_expense' ? tx('已打开记账', 'Opened in ledger') : tx('已保存', 'Saved')}</ThemedText>
      ) : (
        <ActionButton tone="primary" busy={state === 'busy'} disabled={Boolean(blocked) || !run} onPress={() => void confirm()}>{confirmLabel}</ActionButton>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.xs },
});
