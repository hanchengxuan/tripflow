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
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderLeftColor: accent }]}>
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
  card: { borderRadius: 20, borderLeftWidth: 4, padding: 18, gap: 8 },
  title: { fontSize: 20, lineHeight: 26 },
});
