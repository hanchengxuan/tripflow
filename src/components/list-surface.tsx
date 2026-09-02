import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * `raised` is the default: a white surface on the page canvas, as Trips and
 * Ledger use it. `subtle` is for a list that already sits on an elevated
 * surface — inside a bottom sheet, white on white would be invisible.
 */
export function ListSurface({ children, tone = 'raised' }: PropsWithChildren<{ tone?: 'raised' | 'subtle' }>) {
  const theme = useTheme();
  return (
    <View style={[styles.surface, { backgroundColor: tone === 'subtle' ? theme.backgroundSubtle : theme.backgroundElement }]}>
      {children}
    </View>
  );
}

export function ListDivider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
}

export function ListRow({
  accessibilityLabel,
  disabled = false,
  leading,
  onPress,
  subtitle,
  title,
  titleColor,
  trailing,
}: {
  accessibilityLabel?: string;
  disabled?: boolean;
  leading?: ReactNode;
  onPress?: () => void;
  subtitle?: string;
  title: string;
  /** Only for a row whose action is destructive; the label still says so. */
  titleColor?: ThemeColor;
  trailing?: ReactNode;
}) {
  const content = (
    <>
      {leading}
      <View style={styles.copy}>
        <ThemedText style={styles.title} themeColor={titleColor}>{title}</ThemedText>
        {subtitle ? <ThemedText style={styles.subtitle} themeColor="textSecondary">{subtitle}</ThemedText> : null}
      </View>
      {trailing}
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, disabled && styles.disabled]}>
      {content}
    </Pressable>
  ) : <View style={styles.row}>{content}</View>;
}

const styles = StyleSheet.create({
  surface: { borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: 2 },
  row: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 12 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  subtitle: { fontSize: 12, lineHeight: 17 },
  divider: { height: StyleSheet.hairlineWidth },
  pressed: { opacity: 0.68 },
  disabled: { opacity: 0.5 },
});
