import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function KindPill({
  color,
  label,
  softColor,
  solid = false,
}: {
  color: string;
  label: string;
  softColor: string;
  solid?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: solid ? color : softColor }]}>
      {!solid ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
      <ThemedText style={[styles.label, { color: solid ? theme.textOnAccent : color }]}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing['2xs'],
  },
  dot: { width: 7, height: 7, borderRadius: Radius.pill },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
});
