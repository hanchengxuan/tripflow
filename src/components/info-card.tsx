import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

interface InfoCardProps extends PropsWithChildren {
  label?: string;
  title: string;
  accent?: string;
}

export function InfoCard({ title, accent, children }: InfoCardProps) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, shadowColor: theme.shadow }]}
    >
      <View style={styles.titleRow}>
        <View style={[styles.accentDot, { backgroundColor: accent ?? theme.accent }]} />
        <ThemedText type="smallBold" style={styles.title}>
          {title}
        </ThemedText>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 18, gap: 12, shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 7 } },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  accentDot: { width: 8, height: 8, borderRadius: 4 },
  title: { fontSize: 20, lineHeight: 26 },
});
