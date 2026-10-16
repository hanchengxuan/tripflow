import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { ActionButton } from '@/components/form-controls';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** An empty space that says what goes here and offers the one step that fills it. */
export function EmptyState({ symbol, title, body, actionLabel, onAction }: {
  symbol: SymbolViewProps['name'];
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: theme.backgroundElement }]}>
      <View style={[styles.icon, { backgroundColor: theme.accentSoft }]}>
        <SymbolView name={symbol} size={28} tintColor={theme.accent} />
      </View>
      <View style={styles.copy}>
        <ThemedText type="smallBold" style={styles.title}>{title}</ThemedText>
        {body ? <ThemedText type="small" themeColor="textSecondary" style={styles.body}>{body}</ThemedText> : null}
      </View>
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <ActionButton size="compact" onPress={onAction}>{actionLabel}</ActionButton>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: Spacing.md, borderRadius: Radius.xl, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xl },
  icon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  copy: { alignItems: 'center', gap: Spacing.xs },
  title: { fontSize: 16, lineHeight: 22, textAlign: 'center' },
  body: { textAlign: 'center' },
  action: { minWidth: 160 },
});
