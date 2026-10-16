import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { Chevron } from '@/components/chevron';
import { KindPill } from '@/components/kind-pill';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function NextUpCard({
  countdownLabel,
  kindColor,
  kindLabel,
  kindSymbol,
  location,
  mapLabel,
  nextLabel,
  onMapPress,
  onPress,
  timeLabel,
  title,
  travellerCount,
  travellersLabel,
}: {
  /** "In 2 hours" style lead; absent until the clock has been read. */
  countdownLabel?: string;
  kindColor: string;
  kindLabel: string;
  kindSymbol: SymbolViewProps['name'];
  location: string;
  mapLabel: string;
  nextLabel: string;
  onMapPress?: () => void;
  onPress?: () => void;
  timeLabel: string;
  title: string;
  travellerCount: number;
  /** Spoken form of the traveller count, e.g. "4 travellers can see this". */
  travellersLabel: string;
}) {
  const theme = useTheme();
  const place = (
    <>
      <SymbolView name={{ ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' }} size={18} tintColor={theme.textSecondary} />
      <View style={styles.placeCopy}>
        <ThemedText style={styles.placeTitle}>{location}</ThemedText>
        <ThemedText style={styles.placeMeta} themeColor="textSecondary">{mapLabel}</ThemedText>
      </View>
      {onMapPress ? <Chevron color={theme.textSecondary} /> : null}
    </>
  );

  const summary = (
    <>
      <View style={styles.heading}>
        <KindPill color={kindColor} label={kindLabel} softColor={kindColor} symbol={kindSymbol} solid />
        <ThemedText style={styles.eyebrow} themeColor="textSecondary">{nextLabel}</ThemedText>
      </View>
      <ThemedText style={styles.title}>{title}</ThemedText>
      {countdownLabel ? <ThemedText style={[styles.countdown, { color: kindColor }]}>{countdownLabel}</ThemedText> : null}
      <View style={styles.metaRow}>
        <ThemedText style={styles.metaValue} themeColor="textSecondary">{timeLabel}</ThemedText>
        <View accessible accessibilityLabel={travellersLabel} style={styles.travellers}>
          <SymbolView name={{ ios: 'person.2.fill', android: 'group', web: 'group' }} size={16} tintColor={theme.textSecondary} />
          <ThemedText style={styles.metaValue} themeColor="textSecondary">{travellerCount}</ThemedText>
        </View>
      </View>
    </>
  );

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, shadowColor: theme.shadow }]}>
      {onPress ? (
        <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.summary, pressed && styles.pressed]}>{summary}</Pressable>
      ) : <View style={styles.summary}>{summary}</View>}
      {onMapPress ? (
        <Pressable accessibilityRole="link" onPress={onMapPress} style={[styles.place, { backgroundColor: theme.backgroundSelected }]}>
          {place}
        </Pressable>
      ) : <View style={[styles.place, { backgroundColor: theme.backgroundSelected }]}>{place}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius['2xl'],
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    shadowOpacity: 0.08,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 },
  },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  summary: { gap: Spacing.md },
  eyebrow: { fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.8 },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '600' },
  countdown: { fontSize: 22, lineHeight: 28, fontWeight: '700', marginTop: -Spacing.xs },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  travellers: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaValue: { fontSize: 14, lineHeight: 18, fontWeight: '600' },
  place: {
    minHeight: 64,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  placeCopy: { flex: 1, minWidth: 0, gap: 2 },
  placeTitle: { fontSize: 14, lineHeight: 19, fontWeight: '600' },
  placeMeta: { fontSize: 12, lineHeight: 16 },
  pressed: { opacity: 0.72 },
});
