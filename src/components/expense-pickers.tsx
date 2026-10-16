import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { MemberAvatar } from '@/components/member-avatar';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import type { TripMember } from '@/domain/models';
import { useTheme } from '@/hooks/use-theme';

const checkSymbol = { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' } as const;

/** A traveller you can tick: their avatar makes the choice recognisable at a glance. */
export function MemberChip({ member, selected, onPress }: { member: TripMember; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={member.displayName}
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.memberChip,
        { backgroundColor: selected ? theme.accentSoft : theme.backgroundSubtle, borderColor: selected ? theme.accent : 'transparent' },
        pressed && styles.pressed,
      ]}>
      <MemberAvatar avatarUrl={member.avatarUrl} displayName={member.displayName} size={28} />
      <ThemedText style={[styles.memberName, { color: selected ? theme.accentOnSoft : theme.text }]} numberOfLines={1}>{member.displayName}</ThemedText>
      {selected ? <SymbolView name={checkSymbol} size={16} tintColor={theme.accent} /> : null}
    </Pressable>
  );
}

export type SplitMode = 'equal' | 'exact' | 'percentage' | 'shares';

const splitModes: { mode: SplitMode; symbol: SymbolViewProps['name']; title: [string, string]; hint: [string, string] }[] = [
  { mode: 'equal', symbol: { ios: 'equal.circle', android: 'drag_handle', web: 'drag_handle' }, title: ['均分', 'Equal'], hint: ['每人一样多', 'Same for everyone'] },
  { mode: 'exact', symbol: { ios: 'pencil.circle', android: 'edit', web: 'edit' }, title: ['指定金额', 'Exact'], hint: ['逐人填金额', 'Type each amount'] },
  { mode: 'percentage', symbol: { ios: 'percent', android: 'percent', web: 'percent' }, title: ['按比例', 'Percent'], hint: ['如 60% / 40%', 'Like 60% / 40%'] },
  { mode: 'shares', symbol: { ios: 'chart.pie', android: 'pie_chart', web: 'pie_chart' }, title: ['按份数', 'Shares'], hint: ['如 2 份 : 1 份', 'Like 2 : 1'] },
];

/** The four split rules as cards, each with an icon and a one-line example. */
export function SplitModePicker({ value, onChange, tx }: { value: SplitMode; onChange: (mode: SplitMode) => void; tx: (zh: string, en: string) => string }) {
  const theme = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={styles.splitGrid}>
      {splitModes.map(({ mode, symbol, title, hint }) => {
        const selected = value === mode;
        return (
          <Pressable
            key={mode}
            accessibilityRole="radio"
            accessibilityLabel={`${tx(...title)}, ${tx(...hint)}`}
            accessibilityState={{ checked: selected }}
            aria-checked={selected}
            onPress={() => onChange(mode)}
            style={({ pressed }) => [
              styles.splitCard,
              { backgroundColor: selected ? theme.accentSoft : theme.backgroundSubtle, borderColor: selected ? theme.accent : 'transparent' },
              pressed && styles.pressed,
            ]}>
            <SymbolView name={symbol} size={22} tintColor={selected ? theme.accent : theme.textSecondary} />
            <View style={styles.splitCopy}>
              <ThemedText type="smallBold" style={{ color: selected ? theme.accentOnSoft : theme.text }}>{tx(...title)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{tx(...hint)}</ThemedText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  memberChip: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1.5,
    borderRadius: Radius.pill,
    paddingLeft: 4,
    paddingRight: 12,
    maxWidth: '100%',
  },
  memberName: { flexShrink: 1, fontSize: 14, lineHeight: 18, fontWeight: '600' },
  splitGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  splitCard: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  splitCopy: { flex: 1, minWidth: 0, gap: 1 },
  pressed: { opacity: 0.7 },
});
