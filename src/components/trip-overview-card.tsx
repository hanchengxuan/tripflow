import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { AvatarStack } from '@/components/avatar-stack';

import { ActionButton } from '@/components/form-controls';
import { KindPill } from '@/components/kind-pill';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import type { TripMember } from '@/domain/models';
import { useTheme } from '@/hooks/use-theme';

export function TripOverviewCard({
  activeLabel,
  currentLabel,
  dateRange,
  manageLabel,
  members,
  onManage,
  peopleLabel,
  title,
}: {
  activeLabel: string;
  currentLabel: string;
  dateRange: string;
  manageLabel: string;
  members: TripMember[];
  onManage: () => void;
  /** Spoken traveller count, e.g. "4 people". */
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
        <View style={styles.metaItem}>
          <SymbolView name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }} size={18} tintColor={theme.textSecondary} />
          <ThemedText style={styles.metaValue}>{dateRange}</ThemedText>
        </View>
        <View accessible accessibilityLabel={peopleLabel} style={styles.metaItem}>
          <AvatarStack people={members.map(({ userId, displayName, avatarUrl }) => ({ id: userId, displayName, avatarUrl }))} size={26} />
          <ThemedText style={styles.metaValue} themeColor="textSecondary">{members.length}</ThemedText>
        </View>
      </View>
      <ActionButton onPress={onManage}>{manageLabel}</ActionButton>
    </View>
  );
}

/** A small calendar leaf for a trip's start date, so trips scan by when they happen. */
export function TripDateBadge({ startsOn, locale, active }: { startsOn: string; locale: string; active: boolean }) {
  const theme = useTheme();
  const date = new Date(`${startsOn}T12:00:00`);
  const month = locale === 'zh-CN' ? `${date.getMonth() + 1}月` : date.toLocaleDateString(locale, { month: 'short' });
  return (
    <View accessible={false} style={[styles.badge, { backgroundColor: active ? theme.accentSoft : theme.backgroundSubtle }]}>
      <ThemedText style={[styles.badgeMonth, { color: active ? theme.accentOnSoft : theme.textSecondary }]}>{month}</ThemedText>
      <ThemedText style={[styles.badgeDay, { color: active ? theme.accentOnSoft : theme.text }]}>{date.getDate()}</ThemedText>
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
  eyebrowLabel: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '600', letterSpacing: -0.6 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  metaValue: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  badge: { width: 44, height: 48, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  badgeMonth: { fontSize: 11, lineHeight: 14, fontWeight: '600' },
  badgeDay: { fontSize: 18, lineHeight: 22, fontWeight: '700' },
});
