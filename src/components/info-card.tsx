import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

interface InfoCardProps extends PropsWithChildren {
  label: string;
  title: string;
  accent?: string;
}

export function InfoCard({ label, title, accent = '#0F9D7A', children }: InfoCardProps) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
      <ThemedText type="smallBold" style={{ color: accent }}>
        {label}
      </ThemedText>
      <ThemedText type="smallBold" style={styles.title}>
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 1, padding: 18, gap: 8, shadowColor: '#17324D', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  title: { fontSize: 20, lineHeight: 26 },
});
