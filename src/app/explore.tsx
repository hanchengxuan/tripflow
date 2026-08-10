import { StyleSheet, View } from 'react-native';

import { InfoCard } from '@/components/info-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

export default function TripsScreen() {
  return (
    <Screen
      eyebrow="Master trip"
      title="Year-end Asia 2026"
      subtitle="30 days · Hong Kong, Japan and mainland China · 4 travelers">
      <InfoCard label="DAYS 1–10 · SHARED" title="Owner + A + B + C">
        <ThemedText themeColor="textSecondary">Hong Kong → Tokyo · Everyone can edit</ThemedText>
      </InfoCard>
      <View style={styles.branchRow}>
        <View style={styles.branch}>
          <InfoCard label="BRANCH 1 · DAYS 11–30" title="Owner + A" accent="#4B67D1">
            <ThemedText themeColor="textSecondary">Kyoto → Shanghai</ThemedText>
          </InfoCard>
        </View>
        <View style={styles.branch}>
          <InfoCard label="BRANCH 2 · DAYS 11–30" title="B + C" accent="#E7863C">
            <ThemedText themeColor="textSecondary">Osaka → Beijing</ThemedText>
          </InfoCard>
        </View>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Branch details are private by default. Shared return flights and emergency contacts stay at
        trip level.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  branchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  branch: { flexGrow: 1, flexBasis: 260 },
});
