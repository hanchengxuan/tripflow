import { StyleSheet, View } from 'react-native';

import { ActionButton } from '@/components/form-controls';
import { KindPill } from '@/components/kind-pill';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function TripOverviewCard({
  activeLabel,
  currentLabel,
  dateLabel,
  dateRange,
  manageLabel,
  onManage,
  peopleCount,
  peopleLabel,
  title,
}: {
  activeLabel: string;
  currentLabel: string;
  dateLabel: string;
  dateRange: string;
  manageLabel: string;
  onManage: () => void;
  peopleCount: string;
  peopleLabel: string;
  title: string;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, shadowColor: theme.shadow }]}>
      <View style={styles.eyebrow}>
        <KindPill color={theme.kindActivity} label={activeLabel} softColor={theme.kindActivitySoft} solid />
        <ThemedText style={styles.eyebrowLabel} themeColor="textSecondary">{currentLabel}</ThemedText>
      </View>
      <ThemedText style={styles.title}>{title}</ThemedText>
      <View style={styles.meta}>
        <View style={[styles.metaItem, { backgroundColor: theme.backgroundSubtle }]}>
          <ThemedText style={styles.metaLabel} themeColor="textSecondary">{dateLabel}</ThemedText>
          <ThemedText style={styles.metaValue}>{dateRange}</ThemedText>
        </View>
        <View style={[styles.metaItem, { backgroundColor: theme.backgroundSubtle }]}>
          <ThemedText style={styles.metaLabel} themeColor="textSecondary">{peopleLabel}</ThemedText>
          <ThemedText style={styles.metaValue}>{peopleCount}</ThemedText>
        </View>
      </View>
      <ActionButton onPress={onManage}>{manageLabel}</ActionButton>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius['2xl'],
    paddingHorizontal: Spacing.lg,
    paddingVertical: 18,
    gap: 14,
    shadowOpacity: 0.08,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 },
  },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eyebrowLabel: { fontSize: 11, lineHeight: 15, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '600', letterSpacing: -0.6 },
  meta: { flexDirection: 'row', gap: 10 },
  metaItem: { flex: 1, minWidth: 0, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 10, gap: 3 },
  metaLabel: { fontSize: 10, lineHeight: 14, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
  metaValue: { fontSize: 14, lineHeight: 19, fontWeight: '600' },
});
