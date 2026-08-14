import type { ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Chevron } from '@/components/chevron';
import { ThemedText } from '@/components/themed-text';
import type { RouteTravelMode } from '@/domain/models';
import type { RouteEstimate } from '@/features/routes/route-estimate';
import { useTheme } from '@/hooks/use-theme';

export const routeTravelModes: RouteTravelMode[] = ['DRIVE', 'TRANSIT', 'WALK', 'BICYCLE'];

export function routeTravelModeLabel(mode: RouteTravelMode, tx: (zh: string, en: string) => string) {
  return {
    DRIVE: tx('驾车', 'Drive'),
    TRANSIT: tx('公共交通', 'Transit'),
    WALK: tx('步行', 'Walk'),
    BICYCLE: tx('骑行', 'Cycle'),
  }[mode];
}

/** Compact travel summary: mode plus distance/duration, or why it is missing. */
export function RouteEstimateChip({ accessibilityLabel, detail, expanded, modeLabel, onPress }: {
  accessibilityLabel?: string;
  detail: string;
  expanded?: boolean;
  modeLabel: string;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const content: ReactNode = (
    <>
      <ThemedText type="smallBold" style={{ color: theme.info }}>{modeLabel}</ThemedText>
      <View style={[styles.separator, { backgroundColor: theme.info }]} />
      <ThemedText type="small" style={{ color: theme.info }}>{detail}</ThemedText>
    </>
  );
  if (!onPress) return <View style={[styles.chip, { backgroundColor: theme.infoSoft }]}>{content}</View>;
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      hitSlop={5}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, { backgroundColor: theme.infoSoft }, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

export function MapsLink({ url, label }: { url: string; label: string }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => void Linking.openURL(url)}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
      <ThemedText type="smallBold" style={{ color: theme.link }}>{label}</ThemedText>
      <Chevron color={theme.textSecondary} />
    </Pressable>
  );
}

/** Scheduled transit detail: boarding, line, stops, and arrival for each leg. */
export function TransitPlan({
  transit,
  compact,
  tx,
  formatTime,
}: {
  transit: NonNullable<RouteEstimate['transit']>;
  compact: boolean;
  tx: (zh: string, en: string) => string;
  formatTime: (isoTime?: string, localizedTime?: string) => string | undefined;
}) {
  const theme = useTheme();
  const { steps, walking } = transit;
  const walkingMinutes = Math.round(walking.durationSeconds / 60);

  return (
    <View style={[styles.plan, compact && styles.planCompact, { backgroundColor: theme.backgroundSubtle }]}>
      <View style={[styles.planHeading, compact && styles.planHeadingCompact]}>
        <ThemedText type="smallBold">{tx('公交路线', 'Transit route')}</ThemedText>
        {walkingMinutes > 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {tx(`含步行约 ${walkingMinutes} 分钟`, `Includes about ${walkingMinutes} min walking`)}
          </ThemedText>
        ) : null}
      </View>
      {steps.length > 0 ? steps.map((step, index) => {
        const departureTime = formatTime(step.departureTime, step.departureTimeText);
        const arrivalTime = formatTime(step.arrivalTime, step.arrivalTimeText);
        const rideMinutes = Math.max(1, Math.round(step.durationSeconds / 60));
        const line = step.lineName || step.vehicleName || tx('公共交通', 'Transit');
        return (
          <View key={`${step.departureStop}-${step.arrivalStop}-${index}`} style={styles.step}>
            <View style={[styles.stepMarker, { backgroundColor: theme.info }]}>
              <ThemedText type="smallBold" style={{ color: theme.textOnAccent }}>{index + 1}</ThemedText>
            </View>
            <View style={styles.stepCopy}>
              <ThemedText type="smallBold">{[departureTime, line].filter(Boolean).join(' · ')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {step.departureStop || tx('上车站', 'Boarding stop')} → {step.arrivalStop || tx('下车站', 'Arrival stop')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {tx(`${step.stopCount} 站 · 约 ${rideMinutes} 分钟`, `${step.stopCount} stops · about ${rideMinutes} min`)}
                {arrivalTime ? tx(` · ${arrivalTime} 到达`, ` · arrives ${arrivalTime}`) : ''}
              </ThemedText>
              {step.headsign ? <ThemedText type="small" themeColor="textSecondary">{tx(`开往 ${step.headsign}`, `Towards ${step.headsign}`)}</ThemedText> : null}
            </View>
          </View>
        );
      }) : (
        <ThemedText type="small" themeColor="textSecondary">
          {tx('当前路线暂无具体班次信息。', 'Detailed service information is not available for this route.')}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  separator: { width: 3, height: 3, borderRadius: 2 },
  link: { minHeight: 42, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingVertical: 6 },
  pressed: { opacity: 0.68 },
  plan: { borderRadius: 14, padding: 12, gap: 10 },
  planCompact: { padding: 10, gap: 8 },
  planHeading: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  planHeadingCompact: { flexDirection: 'column', alignItems: 'flex-start', gap: 2 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepMarker: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepCopy: { flex: 1, minWidth: 0, gap: 2 },
});
