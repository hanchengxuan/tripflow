import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ListDivider, ListRow, ListSurface } from '@/components/list-surface';
import { SectionHeading } from '@/components/section-heading';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Segment, SegmentMember, TripMember } from '@/domain/models';
import { useI18n } from '@/features/i18n/i18n-provider';
import { isoToZonedDateTime } from '@/lib/trip-time';
import { useTheme } from '@/hooks/use-theme';

/**
 * The trip's branches. Only the ones the reader is allowed to see reach this
 * component — row-level security filters a `members_only` branch out of the
 * query — so an absent branch is genuinely absent, not hidden here.
 */
export function SegmentList({
  canEdit,
  members,
  onDissolve,
  segmentMembers,
  segments,
  timeZone,
}: {
  canEdit: boolean;
  members: TripMember[];
  onDissolve: (segmentId: string) => void;
  segmentMembers: SegmentMember[];
  segments: Segment[];
  timeZone: string;
}) {
  const theme = useTheme();
  const { tx } = useI18n();
  const [confirming, setConfirming] = useState<string>();

  const nameByUserId = new Map(members.map((member) => [member.userId, member.displayName]));

  return (
    <View style={styles.wrap}>
      <SectionHeading
        title={tx('分支', 'Branches')}
        detail={tx('一段时间内只有部分同行者参与。账本仍是整个行程一本。', 'A leg some travellers skip. The ledger stays one ledger for the trip.')}
      />
      <ListSurface>
        {segments.map((segment, index) => {
          const travellers = segmentMembers
            .filter(({ segmentId }) => segmentId === segment.id)
            .map(({ userId }) => nameByUserId.get(userId))
            .filter(Boolean);
          const start = isoToZonedDateTime(segment.startsAt, timeZone);
          const end = isoToZonedDateTime(segment.endsAt, timeZone);
          return (
            <View key={segment.id}>
              {index > 0 ? <ListDivider /> : null}
              <ListRow
                title={segment.name}
                subtitle={`${start.date} — ${end.date} · ${travellers.join('、') || tx('无同行者', 'No travellers')}`}
                trailing={canEdit ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={tx(`解散分支“${segment.name}”`, `Dissolve branch “${segment.name}”`)}
                    hitSlop={6}
                    onPress={() => (confirming === segment.id ? onDissolve(segment.id) : setConfirming(segment.id))}
                    style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
                    <ThemedText type="smallBold" style={{ color: confirming === segment.id ? theme.danger : theme.link }}>
                      {confirming === segment.id ? tx('确认解散', 'Confirm') : tx('解散', 'Dissolve')}
                    </ThemedText>
                  </Pressable>
                ) : undefined}
              />
              {confirming === segment.id ? (
                <View style={styles.hint}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {tx('解散后这段安排会回到整个行程，所有人都能看到。安排本身不会被删除。',
                        'Its plans return to the whole trip and become visible to everyone. Nothing is deleted.')}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          );
        })}
      </ListSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing['2xs'] },
  hint: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  pressed: { opacity: 0.68 },
});
