import { Pressable, StyleSheet, View } from 'react-native';

import { Chevron } from '@/components/chevron';
import { KindPill } from '@/components/kind-pill';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function NextUpCard({
  kindColor,
  kindLabel,
  location,
  mapLabel,
  nextLabel,
  onMapPress,
  onPress,
  timeLabel,
  timeMetaLabel,
  title,
  travellersMetaLabel,
  travellersLabel,
}: {
  kindColor: string;
  kindLabel: string;
  location: string;
  mapLabel: string;
  nextLabel: string;
  onMapPress?: () => void;
  onPress?: () => void;
  timeLabel: string;
  timeMetaLabel: string;
  title: string;
  travellersMetaLabel: string;
  travellersLabel: string;
}) {
  const theme = useTheme();
  const place = (
    <>
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
        <KindPill color={kindColor} label={kindLabel} softColor={kindColor} solid />
        <ThemedText style={styles.eyebrow} themeColor="textSecondary">{nextLabel}</ThemedText>
      </View>
      <ThemedText style={styles.title}>{title}</ThemedText>
      <View style={styles.metaGrid}>
        <View style={[styles.metaTile, { backgroundColor: theme.backgroundSubtle }]}>
          <ThemedText style={styles.metaLabel}>{timeMetaLabel}</ThemedText>
          <ThemedText style={styles.metaValue} themeColor="textSecondary">{timeLabel}</ThemedText>
        </View>
        <View style={[styles.metaTile, { backgroundColor: theme.backgroundSubtle }]}>
          <ThemedText style={styles.metaLabel}>{travellersMetaLabel}</ThemedText>
          <ThemedText style={styles.metaValue} themeColor="textSecondary">{travellersLabel}</ThemedText>
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
  metaGrid: { flexDirection: 'row', gap: Spacing.sm },
  metaTile: { flex: 1, minWidth: 0, gap: 4, borderRadius: Radius.sm, padding: Spacing.sm },
  metaLabel: { fontSize: 10, lineHeight: 14, fontWeight: '700', letterSpacing: 0.5 },
  metaValue: { fontSize: 13, lineHeight: 18 },
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
