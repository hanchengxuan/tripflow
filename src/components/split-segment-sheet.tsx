import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { DateTimePairField } from '@/components/date-time-pair-field';
import { ActionButton, FormField, InlineNotice } from '@/components/form-controls';
import { MemberAvatar } from '@/components/member-avatar';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import type { ItineraryItem, SegmentVisibility, TripMember } from '@/domain/models';
import { useI18n } from '@/features/i18n/i18n-provider';
import { isoToZonedDateTime, zonedDateTimeToIso } from '@/lib/trip-time';
import { toUserMessage } from '@/lib/user-error';
import { useTheme } from '@/hooks/use-theme';

/**
 * "Split from here."
 *
 * The window opens at the plan the traveller tapped and runs to the end of the
 * trip, which is the case this exists for: partway through, some people peel
 * off. Everyone is selected by default and the split is expressed by removing
 * the people who are not coming, rather than by rebuilding the group.
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
  const { tx } = useI18n();
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
      setError(toUserMessage(caught, tx('无法拆分这段行程，请稍后重试。', 'Could not split this leg. Please try again.')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet onDismiss={onDismiss} title={tx('从这里拆分', 'Split from here')} visible={visible}>
      <View style={styles.form}>
        <ThemedText type="small" themeColor="textSecondary">
          {tx('这段时间内的安排会移到分支里，只有分支同行者能看到。账本仍然是整个行程一本。',
              'Plans inside this window move to the branch and only its travellers can see them. The ledger stays one ledger for the whole trip.')}
        </ThemedText>

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

        <View style={styles.travellers}>
          <ThemedText type="smallBold">{tx('谁继续同行', 'Who is continuing')}</ThemedText>
          {members.map((member) => {
            const going = !excluded.includes(member.userId);
            return (
              <Pressable
                key={member.userId}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: going }}
                onPress={() => setExcluded((current) => (
                  current.includes(member.userId)
                    ? current.filter((id) => id !== member.userId)
                    : [...current, member.userId]
                ))}
                style={({ pressed }) => [
                  styles.traveller,
                  { borderColor: going ? theme.accent : theme.border, backgroundColor: going ? theme.backgroundSelected : 'transparent' },
                  pressed && styles.pressed,
                ]}>
                <MemberAvatar avatarUrl={member.avatarUrl} displayName={member.displayName} size={32} />
                <ThemedText type="smallBold" style={styles.travellerName}>{member.displayName}</ThemedText>
                <ThemedText type="small" themeColor={going ? 'accentOnSoft' : 'textMuted'}>
                  {going ? tx('同行', 'Going') : tx('不去', 'Not going')}
                </ThemedText>
              </Pressable>
            );
          })}
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
  traveller: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.sm },
  travellerName: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.68 },
});
