import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { DateTimePairField } from '@/components/date-time-pair-field';
import { ActionButton, FormField, InlineNotice } from '@/components/form-controls';
import { ListDivider, ListSurface } from '@/components/list-surface';
import { MemberAvatar } from '@/components/member-avatar';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { ItineraryItem, SegmentVisibility, TripMember } from '@/domain/models';
import { useI18n } from '@/features/i18n/i18n-provider';
import { formatZonedDateTimeRange, isoToZonedDateTime, zonedDateTimeToIso } from '@/lib/trip-time';
import { toUserMessage } from '@/lib/user-error';
import { useTheme } from '@/hooks/use-theme';

/**
 * Splitting off from a plan.
 *
 * Reached from that plan's editor rather than from the timeline: branching is
 * a rare, per-plan action, and the timeline already routes per-plan actions —
 * deleting among them — through the editor. A link on every row read as
 * repetition long before it read as an affordance.
 *
 * The window opens at the plan and runs to the end of the trip, which is the
 * case this exists for: partway through, some people peel off. Everyone is
 * selected by default and the split is expressed by removing the people who
 * are not coming, rather than by rebuilding the group.
 */
export function SplitSegmentSheet({
  fromItem,
  members,
  onDismiss,
  onSplit,
  timeZone,
  tripEndsOn,
  visible,
}: {
  fromItem?: ItineraryItem;
  members: TripMember[];
  onDismiss: () => void;
  onSplit: (input: { name: string; startsAt: string; endsAt: string; memberIds: string[]; visibility: SegmentVisibility }) => Promise<void>;
  timeZone: string;
  tripEndsOn: string;
  visible: boolean;
}) {
  const theme = useTheme();
  const { languageTag, tx } = useI18n();
  // The window opens at the tapped plan. The parent remounts this with a
  // `key` per plan rather than syncing props into state from an effect.
  const openAt = fromItem ? isoToZonedDateTime(fromItem.startsAt, timeZone) : undefined;
  const [name, setName] = useState(() => tx('后半段', 'Second half'));
  const [startDate, setStartDate] = useState(() => openAt?.date ?? '');
  const [startTime, setStartTime] = useState(() => openAt?.time ?? '09:00');
  const [endDate, setEndDate] = useState(tripEndsOn);
  const [endTime, setEndTime] = useState('23:59');
  const [excluded, setExcluded] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const goingIds = members.filter(({ userId }) => !excluded.includes(userId)).map(({ userId }) => userId);
  // Stated the way the rest of the product states a moment, not as raw ISO.
  const opensAt = startDate
    ? formatZonedDateTimeRange(zonedDateTimeToIso(startDate, startTime, timeZone), undefined, languageTag, timeZone)
    : '';

  async function submit() {
    setBusy(true);
    setError(undefined);
    try {
      await onSplit({
        name,
        startsAt: zonedDateTimeToIso(startDate, startTime, timeZone),
        endsAt: zonedDateTimeToIso(endDate, endTime, timeZone),
        memberIds: goingIds,
        // The point of a branch is that the people who are not on it do not
        // have to read around it.
        visibility: 'members_only',
      });
      onDismiss();
    } catch (caught) {
      setError(toUserMessage(caught, tx('无法创建分支，请稍后重试。', 'Could not create the branch. Please try again.')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet onDismiss={onDismiss} title={tx('从这里分开走', 'Split off from here')} visible={visible}>
      <View style={styles.form}>
        {/* The consequence keeps the shape the system already uses for one. */}
        <InlineNotice>
          {tx(`${opensAt} 起的安排会移到分支里，只有同行的人看得到。账本仍然是整个行程一本。`,
              `Plans from ${opensAt} move to the branch and only its travellers can see them. The ledger stays one ledger for the whole trip.`)}
        </InlineNotice>

        <FormField label={tx('分支名称', 'Branch name')} value={name} onChangeText={setName} placeholder={tx('例如：后半段', 'For example: Second half')} />

        <View style={styles.dateRow}>
          <DateTimePairField
            label={tx('从', 'From')}
            dateLabel={tx('开始日期', 'Start date')}
            dateValue={startDate}
            timeLabel={tx('开始时间', 'Start time')}
            timeValue={startTime}
            onDateChange={setStartDate}
            onTimeChange={setStartTime}
            stacked
          />
          <DateTimePairField
            label={tx('到', 'To')}
            dateLabel={tx('结束日期', 'End date')}
            dateValue={endDate}
            timeLabel={tx('结束时间', 'End time')}
            timeValue={endTime}
            onDateChange={setEndDate}
            onTimeChange={setEndTime}
            stacked
          />
        </View>

        {/* One surface, hairline-separated rows, a trailing check. Five bordered
            cards used to be stroked in `accent` while the primary button below
            was the same colour; accent marks one path per surface, and here it
            is 创建分支. The state is still named, never carried by the check
            alone. */}
        <View style={styles.travellers}>
          <View style={styles.travellersHead}>
            <ThemedText type="smallBold">{tx('谁继续同行', 'Who is continuing')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {tx(`${goingIds.length} / ${members.length} 人`, `${goingIds.length} of ${members.length}`)}
            </ThemedText>
          </View>
          <ListSurface tone="subtle">
            {members.map((member, index) => {
              const going = !excluded.includes(member.userId);
              return (
                <View key={member.userId}>
                  {index > 0 ? <ListDivider /> : null}
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityLabel={member.displayName}
                    accessibilityState={{ checked: going }}
                    onPress={() => setExcluded((current) => (
                      current.includes(member.userId)
                        ? current.filter((id) => id !== member.userId)
                        : [...current, member.userId]
                    ))}
                    style={({ pressed }) => [styles.traveller, pressed && styles.pressed]}>
                    <MemberAvatar avatarUrl={member.avatarUrl} displayName={member.displayName} size={32} />
                    <ThemedText
                      type="smallBold"
                      themeColor={going ? 'text' : 'textMuted'}
                      numberOfLines={1}
                      style={styles.travellerName}>
                      {going ? member.displayName : tx(`${member.displayName} · 不去`, `${member.displayName} · not going`)}
                    </ThemedText>
                    <View
                      style={[
                        styles.check,
                        going
                          ? { backgroundColor: theme.accent }
                          : { borderWidth: 1.5, borderColor: theme.borderField },
                      ]}>
                      {going ? <View style={[styles.checkMark, { borderColor: theme.textOnAccent }]} /> : null}
                    </View>
                  </Pressable>
                </View>
              );
            })}
          </ListSurface>
        </View>

        {goingIds.length === 0 ? (
          <InlineNotice tone="error">{tx('分支至少需要一位同行者。', 'A branch needs at least one traveller.')}</InlineNotice>
        ) : null}
        {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}

        <ActionButton tone="primary" busy={busy} disabled={!name.trim() || goingIds.length === 0} onPress={() => void submit()}>
          {tx('创建分支', 'Create branch')}
        </ActionButton>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: { width: '100%', gap: Spacing.md },
  dateRow: { gap: Spacing.sm },
  travellers: { gap: Spacing.xs },
  travellersHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: Spacing.sm },
  traveller: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  travellerName: { flex: 1, minWidth: 0 },
  check: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  // A tick drawn from two borders of a rotated box, the same trick `Chevron`
  // uses, so the check needs no icon font or SVG.
  checkMark: { width: 10, height: 5, marginTop: -3, borderLeftWidth: 1.8, borderBottomWidth: 1.8, transform: [{ rotate: '-45deg' }] },
  pressed: { opacity: 0.68 },
});
