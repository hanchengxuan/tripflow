import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface StayCardProps {
  dateRange: string;
  location: string;
  nights: number;
  style?: StyleProp<ViewStyle>;
  title: string;
}

export function StayCard({ dateRange, location, nights, style, title }: StayCardProps) {
  const theme = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }, style]}>
      <View style={[styles.kindBar, { backgroundColor: theme.kindLodging }]} />
      <View style={styles.copy}>
        <ThemedText style={styles.title}>{title}</ThemedText>
        <ThemedText style={styles.dateRange} themeColor="textSecondary">{dateRange}</ThemedText>
        <ThemedText style={styles.location} themeColor="textMuted">{location}</ThemedText>
      </View>
      <View style={[styles.nights, { backgroundColor: theme.kindLodgingSoft }]}>
        <ThemedText style={[styles.nightsValue, { color: theme.kindLodging }]}>{nights}</ThemedText>
        <ThemedText style={[styles.nightsLabel, { color: theme.kindLodging }]}>晚 nights</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  kindBar: { width: Spacing['2xs'], alignSelf: 'stretch', borderRadius: Spacing.half, flexShrink: 0 },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  dateRange: { fontSize: 13, lineHeight: 18 },
  location: { fontSize: 13, lineHeight: 18 },
  nights: {
    flexShrink: 0,
    alignItems: 'center',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  nightsValue: { fontSize: 18, lineHeight: 22, fontWeight: '600' },
  nightsLabel: { fontSize: 10, lineHeight: 14, fontWeight: '500' },
});
