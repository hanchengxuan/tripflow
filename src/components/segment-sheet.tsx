import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { ActionButton, InlineNotice } from '@/components/form-controls';
import { Chevron } from '@/components/chevron';
import { ListDivider, ListRow, ListSurface } from '@/components/list-surface';
import { MemberAvatar } from '@/components/member-avatar';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { ItineraryItem, Segment, SegmentMember, TripMember } from '@/domain/models';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useTheme } from '@/hooks/use-theme';
import { formatDayRange, isoToZonedDateTime } from '@/lib/trip-time';

const AVATAR_SIZE = 28;
const AVATAR_OVERLAP = -8;
const SHOWN_AVATARS = 3;

/**
 * Branch management.
 *
 * Off the timeline: a branch is a rare, per-trip arrangement, and the list used
 * to sit between the search field and the first plan, pushing the rail below
 * the fold. Dissolving now states its consequence once and commits from a
 * single destructive action, instead of a two-tap trailing link that reflowed
 * the rows under the reader's thumb.
 *
 * Only the branches the reader is allowed to see reach this component — row
 * level security filters a `members_only` branch out of the query — so an
 * absent branch is genuinely absent, not hidden here.
 */
export function SegmentSheet({
  canEdit,
  items,
  members,
  onDismiss,
  onDissolve,
  segmentMembers,
  segments,
  timeZone,
  visible,
}: {
  canEdit: boolean;
  items: ItineraryItem[];
  members: TripMember[];
  onDismiss: () => void;
  onDissolve: (segmentId: string) => void;
  segmentMembers: SegmentMember[];
  segments: Segment[];
  timeZone: string;
  visible: boolean;
}) {
  const { languageTag, tx } = useI18n();
  const theme = useTheme();
  const [selectedId, setSelectedId] = useState<string>();

  const memberByUserId = new Map(members.map((member) => [member.userId, member]));
  const selected = segments.find(({ id }) => id === selectedId);
  const selectedPlanCount = selected ? items.filter(({ segmentId }) => segmentId === selected.id).length : 0;

  function close() {
    setSelectedId(undefined);
    onDismiss();
  }

  return (
    <BottomSheet onDismiss={close} title={tx('分支', 'Branches')} visible={visible}>
      <ThemedText type="small" themeColor="textSecondary">
        {tx('一段时间内只有部分同行者参与。账本仍是整个行程一本。',
            'A leg some travellers skip. The ledger stays one ledger for the trip.')}
      </ThemedText>

      <ListSurface>
        {segments.map((segment, index) => {
          const travellers = segmentMembers
            .filter(({ segmentId }) => segmentId === segment.id)
            .map(({ userId }) => memberByUserId.get(userId))
            .filter((member): member is TripMember => Boolean(member));
          const planCount = items.filter(({ segmentId }) => segmentId === segment.id).length;
          const range = formatDayRange(
            isoToZonedDateTime(segment.startsAt, timeZone).date,
            isoToZonedDateTime(segment.endsAt, timeZone).date,
            languageTag,
          );
          return (
            <View key={segment.id}>
              {index > 0 ? <ListDivider /> : null}
              <ListRow
                leading={travellers.length > 0 ? (
                  <View style={styles.avatars}>
                    {travellers.slice(0, SHOWN_AVATARS).map((member, position) => (
                      <View key={member.userId} style={position > 0 ? styles.avatarStacked : undefined}>
                        <MemberAvatar avatarUrl={member.avatarUrl} displayName={member.displayName} size={AVATAR_SIZE} />
                      </View>
                    ))}
                  </View>
                ) : undefined}
                title={segment.name}
                subtitle={[
                  range,
                  tx(`${travellers.length} 位同行者`, `${travellers.length} travelling`),
                  tx(`${planCount} 项安排`, `${planCount} plans`),
                ].join(' · ')}
                onPress={canEdit ? () => setSelectedId(segment.id === selectedId ? undefined : segment.id) : undefined}
                trailing={canEdit ? <Chevron color={theme.textMuted} direction={segment.id === selectedId ? 'down' : 'right'} /> : undefined}
              />
            </View>
          );
        })}
      </ListSurface>

      {selected ? (
        <View style={styles.dissolve}>
          <ThemedText type="smallBold">
            {tx(`解散“${selected.name}”`, `Dissolve “${selected.name}”`)}
          </ThemedText>
          <InlineNotice tone="error">
            {tx(`这 ${selectedPlanCount} 项安排会回到整个行程，所有人都能看到。安排本身不会被删除。`,
                `Its ${selectedPlanCount} plans return to the whole trip and become visible to everyone. Nothing is deleted.`)}
          </InlineNotice>
          <ActionButton tone="danger" onPress={() => { onDissolve(selected.id); close(); }}>
            {tx('解散分支', 'Dissolve branch')}
          </ActionButton>
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  avatars: { flexDirection: 'row' },
  avatarStacked: { marginLeft: AVATAR_OVERLAP },
  dissolve: { gap: Spacing.sm },
});
