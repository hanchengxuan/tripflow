import { Pressable, StyleSheet, View } from 'react-native';

import { InfoCard } from '@/components/info-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

export default function TodayScreen() {
  return (
    <Screen
      eyebrow="Hong Kong · Day 3 of 30"
      title="Good morning, Liam"
      subtitle="Your group is together today. The next step is ready offline.">
      <InfoCard label="NEXT STEP · 09:40" title="Take the MTR to Central">
        <ThemedText themeColor="textSecondary">
          Leave the hotel in 18 minutes · 4 travelers · A has the booking QR
        </ThemedText>
        <View style={styles.statusRow}>
          <ThemedText type="smallBold">3/4 confirmed</ThemedText>
          <Pressable style={styles.action} accessibilityRole="button">
            <ThemedText type="smallBold" style={styles.actionText}>
              I&apos;m going
            </ThemedText>
          </Pressable>
        </View>
      </InfoCard>

      <InfoCard label="TODAY · 11:00" title="Dim sum at Lin Heung Tea House" accent="#E7863C">
        <ThemedText themeColor="textSecondary">
          Poll winner · Owner, A, B and C · Reservation under A
        </ThemedText>
      </InfoCard>

      <InfoCard label="REGION READY" title="Hong Kong essentials" accent="#4B67D1">
        <ThemedText themeColor="textSecondary">
          Octopus ready · eSIM connected · offline addresses downloaded
        </ThemedText>
      </InfoCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  action: { backgroundColor: '#0F9D7A', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  actionText: { color: '#FFFFFF' },
});
