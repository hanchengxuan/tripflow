import { StyleSheet, View } from 'react-native';

import { MemberAvatar } from '@/components/member-avatar';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import type { TripMember } from '@/domain/models';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useTheme } from '@/hooks/use-theme';
import { isoToZonedDateTime, tripProgress } from '@/lib/trip-time';

const MAX_AVATARS = 4;

/** Where today falls in the trip, plus who is on it. */
export function TripProgress({ startsOn, endsOn, timeZone, now, members }: {
  startsOn: string;
  endsOn: string;
  timeZone: string;
  now: number;
  members: TripMember[];
}) {
  const theme = useTheme();
  const { tx } = useI18n();
  const progress = tripProgress(startsOn, endsOn, isoToZonedDateTime(new Date(now).toISOString(), timeZone).date);
  const label = progress.status === 'upcoming'
    ? tx(`还有 ${progress.daysUntil} 天出发 · 共 ${progress.totalDays} 天`, `${progress.daysUntil} ${progress.daysUntil === 1 ? 'day' : 'days'} to go · ${progress.totalDays} days`)
    : progress.status === 'active'
      ? tx(`第 ${progress.day} 天 · 共 ${progress.totalDays} 天`, `Day ${progress.day} of ${progress.totalDays}`)
      : tx(`行程已结束 · 共 ${progress.totalDays} 天`, `Trip ended · ${progress.totalDays} days`);
  const fraction = progress.status === 'active' ? progress.day / progress.totalDays : progress.status === 'ended' ? 1 : 0;
  const shown = members.slice(0, MAX_AVATARS);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <ThemedText type="smallBold">{label}</ThemedText>
        <View
          accessible
          accessibilityLabel={tx(`${members.length} 人同行`, `${members.length} ${members.length === 1 ? 'traveller' : 'travellers'}`)}
          style={styles.avatars}>
          {shown.map((member, index) => (
            <View key={member.userId} style={[styles.avatarRing, { borderColor: theme.background }, index > 0 && styles.overlap]}>
              <MemberAvatar avatarUrl={member.avatarUrl} displayName={member.displayName} size={26} />
            </View>
          ))}
          {members.length > MAX_AVATARS ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.more}>+{members.length - MAX_AVATARS}</ThemedText>
          ) : null}
        </View>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}
        style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View style={[styles.fill, { width: `${fraction * 100}%`, backgroundColor: theme.accent }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  avatarRing: { borderWidth: 2, borderRadius: Radius.pill },
  overlap: { marginLeft: -8 },
  more: { marginLeft: Spacing.xs },
  track: { height: 6, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill },
});
