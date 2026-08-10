import { Pressable, StyleSheet, View } from 'react-native';

import { InfoCard } from '@/components/info-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

export default function LedgerScreen() {
  return (
    <Screen
      eyebrow="Group ledger"
      title="Everything reconciles"
      subtitle="Original currencies are preserved. Home-currency totals are estimates.">
      <Pressable style={styles.voiceButton} accessibilityRole="button">
        <ThemedText type="smallBold" style={styles.voiceText}>
          Hold to record an expense
        </ThemedText>
        <ThemedText type="small" style={styles.voiceHint}>
          “Dinner was HK$860. A paid. Me, A and B split equally.”
        </ThemedText>
      </Pressable>

      <InfoCard label="YOU ARE OWED" title="¥415.00" accent="#0F9D7A">
        <View style={styles.balanceRow}>
          <ThemedText themeColor="textSecondary">A owes you</ThemedText>
          <ThemedText type="smallBold">¥630.00</ThemedText>
        </View>
        <View style={styles.balanceRow}>
          <ThemedText themeColor="textSecondary">You owe C</ThemedText>
          <ThemedText type="smallBold">¥215.00</ThemedText>
        </View>
      </InfoCard>

      <InfoCard label="RECENT · HKD" title="Dinner · HK$860.00" accent="#E7863C">
        <ThemedText themeColor="textSecondary">
          A paid · Owner, A and B split · C excluded
        </ThemedText>
      </InfoCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  voiceButton: { backgroundColor: '#0F9D7A', borderRadius: 22, padding: 20, gap: 6 },
  voiceText: { color: '#FFFFFF', fontSize: 18 },
  voiceHint: { color: '#D7FFF4' },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
});
