import { StyleSheet, View } from 'react-native';

import { MemberAvatar } from '@/components/member-avatar';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/** Overlapping avatars that collapse into "+N" past `max`. Decorative: callers name the people in their own label. */
export function AvatarStack({ people, max = 4, size = 22 }: {
  people: { id: string; displayName: string; avatarUrl?: string }[];
  max?: number;
  size?: number;
}) {
  const theme = useTheme();
  if (people.length === 0) return null;
  const shown = people.length > max ? people.slice(0, max - 1) : people;
  const hidden = people.length - shown.length;
  const ring = { width: size + 3, height: size + 3, borderRadius: (size + 3) / 2, borderColor: theme.backgroundSubtle };

  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.stack}>
      {shown.map((person, index) => (
        <View key={person.id} style={[styles.ring, ring, index > 0 && styles.overlap]}>
          <MemberAvatar avatarUrl={person.avatarUrl} displayName={person.displayName} size={size} />
        </View>
      ))}
      {hidden > 0 ? (
        <View style={[styles.ring, ring, styles.overlap, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText style={[styles.more, { color: theme.textSecondary }]}>+{hidden}</ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { flexDirection: 'row', alignItems: 'center' },
  ring: { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  overlap: { marginLeft: -7 },
  more: { fontSize: 11, lineHeight: 14, fontWeight: '700' },
});
