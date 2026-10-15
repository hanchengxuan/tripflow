import { StyleSheet, View } from 'react-native';

import { ChoiceChip } from '@/components/form-controls';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useI18n } from '@/features/i18n/i18n-provider';
import type { PlanTimeShift } from '@/lib/trip-time';

export function QuickTimeShifts({ allowExtend, onShift }: { allowExtend: boolean; onShift: (shift: PlanTimeShift) => void }) {
  const { tx } = useI18n();
  const shifts: { key: string; label: string; shift: PlanTimeShift }[] = [
    { key: 'earlier-30', label: tx('早 30 分', '30 min earlier'), shift: { kind: 'move', minutes: -30 } },
    { key: 'later-30', label: tx('晚 30 分', '30 min later'), shift: { kind: 'move', minutes: 30 } },
    { key: 'later-60', label: tx('晚 1 小时', '1 hr later'), shift: { kind: 'move', minutes: 60 } },
    ...(allowExtend ? [{ key: 'extend-30', label: tx('延长 30 分', '30 min longer'), shift: { kind: 'extend', minutes: 30 } } as const] : []),
    { key: 'next-day', label: tx('改到次日', 'Next day'), shift: { kind: 'move', minutes: 24 * 60 } },
  ];

  return (
    <View style={styles.root}>
      <ThemedText type="small" themeColor="textSecondary">{tx('快速调整时间，保存后生效', 'Quick time changes apply when you save')}</ThemedText>
      <View style={styles.chips}>
        {shifts.map(({ key, label, shift }) => (
          <ChoiceChip key={key} role="button" selected={false} onPress={() => onShift(shift)}>{label}</ChoiceChip>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
