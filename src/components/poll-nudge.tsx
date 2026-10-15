import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Chevron } from '@/components/chevron';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useI18n } from '@/features/i18n/i18n-provider';
import { pollStatus } from '@/features/polls/poll-state';
import { useTripPolls } from '@/features/polls/use-trip-polls';
import { useTheme } from '@/hooks/use-theme';

/** One line on Today when an open poll still needs the traveller's vote; the polls themselves live on the Trips tab. */
export function PollNudge({ tripId, currentUserId }: { tripId: string; currentUserId: string }) {
  const theme = useTheme();
  const router = useRouter();
  const { tx } = useI18n();
  const { polls } = useTripPolls(tripId);
  const [now] = useState(() => new Date());
  const waiting = (polls ?? []).filter((poll) => pollStatus(poll, now) === 'open' && !poll.votes.some((vote) => vote.userId === currentUserId));
  if (waiting.length === 0) return null;

  const label = waiting.length === 1
    ? tx(`投票等你：${waiting[0].question}`, `Your vote is needed: ${waiting[0].question}`)
    : tx(`有 ${waiting.length} 个投票等你`, `${waiting.length} polls need your vote`);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${label}. ${tx('去投票', 'Vote now')}`}
      onPress={() => router.push('/explore')}
      style={({ pressed }) => [styles.row, { backgroundColor: theme.accentSoft }, pressed && styles.pressed]}>
      <View style={[styles.dot, { backgroundColor: theme.accent }]} />
      <ThemedText type="smallBold" style={styles.grow} numberOfLines={1}>{label}</ThemedText>
      <ThemedText type="smallBold" style={{ color: theme.accent }}>{tx('去投票', 'Vote')}</ThemedText>
      <Chevron color={theme.accent} direction="right" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 48, borderRadius: Radius.md, paddingHorizontal: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  grow: { flex: 1 },
  pressed: { opacity: 0.75 },
});
