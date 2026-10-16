import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function KindPill({
  color,
  label,
  softColor,
  solid = false,
  symbol,
  iconOnly = false,
}: {
  color: string;
  label: string;
  softColor: string;
  solid?: boolean;
  symbol?: SymbolViewProps['name'];
  /** Shows only the symbol; the label stays available to screen readers. */
  iconOnly?: boolean;
}) {
  const theme = useTheme();
  const foreground = solid ? theme.textOnAccent : color;
  return (
    <View
      accessible={iconOnly}
      accessibilityLabel={iconOnly ? label : undefined}
      style={[styles.pill, iconOnly && styles.iconOnly, { backgroundColor: solid ? color : softColor }]}>
      {symbol ? <SymbolView name={symbol} size={14} tintColor={foreground} /> : !solid ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
      {iconOnly ? null : <ThemedText style={[styles.label, { color: foreground }]}>{label}</ThemedText>}
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
  iconOnly: { width: 28, paddingHorizontal: 0, justifyContent: 'center' },
  dot: { width: 7, height: 7, borderRadius: Radius.pill },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
});
