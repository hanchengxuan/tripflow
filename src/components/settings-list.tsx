import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Chevron } from '@/components/chevron';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * One way to write a settings row.
 *
 * The rule the row exists to hold: **the trailing element says what pressing
 * the row does.** A chevron means the row takes you somewhere — a panel or
 * another screen. A row that acts in place, like signing out, carries none.
 *
 * Me previously used four row idioms in one scroll — 48pt label-and-value,
 * 52pt with the word 管理 as its affordance, 56pt disclosure, and an unfixed
 * row holding chips — so nothing on the screen let a reader predict a press.
 */
export function SettingsGroup({ children, label }: PropsWithChildren<{ label?: string }>) {
  const theme = useTheme();
  return (
    <View style={styles.group}>
      {label ? (
        <ThemedText type="small" themeColor="textMuted" style={styles.groupLabel}>{label}</ThemedText>
      ) : null}
      <View style={[styles.surface, { backgroundColor: theme.backgroundElement }]}>{children}</View>
    </View>
  );
}

export function SettingsDivider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
}

export function SettingsRow({
  accessibilityLabel,
  busy = false,
  chevron,
  control,
  disabled = false,
  label,
  labelColor,
  leading,
  onPress,
  subtitle,
  value,
  valueColor,
}: {
  accessibilityLabel?: string;
  busy?: boolean;
  /** Defaults to true for a pressable row. False for one that acts in place. */
  chevron?: boolean;
  /** A control the row holds rather than opens; never combined with onPress. */
  control?: ReactNode;
  disabled?: boolean;
  label: string;
  labelColor?: ThemeColor;
  leading?: ReactNode;
  onPress?: () => void;
  subtitle?: string;
  value?: string;
  /** Only where the value carries a direction — money owed out or owed in. */
  valueColor?: string;
}) {
  const theme = useTheme();
  const content = (
    <>
      {leading}
      <View style={styles.copy}>
        <ThemedText themeColor={labelColor} style={styles.label}>{label}</ThemedText>
        {subtitle ? <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{subtitle}</ThemedText> : null}
      </View>
      {value ? (
        <ThemedText type="smallBold" themeColor="textSecondary" numberOfLines={1} style={[styles.value, valueColor ? { color: valueColor } : null]}>{value}</ThemedText>
      ) : null}
      {control}
      {onPress && (chevron ?? true) ? <Chevron color={labelColor === 'danger' ? theme.danger : theme.textMuted} /> : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ busy, disabled }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, (disabled || busy) && styles.dimmed]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.xs },
  groupLabel: { fontSize: 12, lineHeight: 17, fontWeight: '700', letterSpacing: 0.6, paddingHorizontal: Spacing['2xs'] },
  surface: { borderRadius: Radius.lg, paddingHorizontal: Spacing.md },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 10 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  label: { fontSize: 15, lineHeight: 21 },
  value: { flexShrink: 1, textAlign: 'right' },
  divider: { height: StyleSheet.hairlineWidth },
  pressed: { opacity: 0.68 },
  dimmed: { opacity: 0.5 },
});
