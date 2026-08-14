import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function ListSurface({ children }: PropsWithChildren) {
  const theme = useTheme();
  return <View style={[styles.surface, { backgroundColor: theme.backgroundElement }]}>{children}</View>;
}

export function ListDivider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
}

export function ListRow({
  leading,
  onPress,
  subtitle,
  title,
  trailing,
}: {
  leading?: ReactNode;
  onPress?: () => void;
  subtitle?: string;
  title: string;
  trailing?: ReactNode;
}) {
  const content = (
    <>
      {leading}
      <View style={styles.copy}>
        <ThemedText style={styles.title}>{title}</ThemedText>
        {subtitle ? <ThemedText style={styles.subtitle} themeColor="textSecondary">{subtitle}</ThemedText> : null}
      </View>
      {trailing}
    </>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
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
});
