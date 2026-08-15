import type { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The shared time rail.
 *
 * Times sit in a fixed gutter so every title starts on the same axis, and a
 * continuous spine runs the whole day. Travel between two plans belongs in
 * `RouteSegment`, which occupies the gap rather than nesting inside a row.
 */

const SPINE_WIDTH = 12;
const ROUTE_DASHES = Array.from({ length: 40 }, (_, index) => index);

function DashedSpine({ color }: { color: string }) {
  return (
    <View style={styles.dashedSpine}>
      {ROUTE_DASHES.map((index) => (
        <View key={index} style={[styles.routeDash, { backgroundColor: color, top: index * 9 }]} />
      ))}
    </View>
  );
}

export function DaySeparator({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.daySeparator}>
      <View style={styles.gutter} />
      <View style={styles.spine}>
        <View style={[styles.spineLine, { backgroundColor: theme.border }]} />
      </View>
      <View style={styles.dayCopy}>
        <ThemedText type="smallBold" themeColor="textSecondary">{label}</ThemedText>
        <View style={[styles.dayRule, { backgroundColor: theme.border }]} />
      </View>
    </View>
  );
}

export function TimelineRow({
  startLabel,
  endLabel,
  title,
  place,
  kindColor,
  kindLabel,
  kindSoftColor,
  last = false,
  children,
}: PropsWithChildren<{
  startLabel: string;
  endLabel?: string;
  title: string;
  place?: string;
  kindColor: string;
  kindSoftColor: string;
  kindLabel: string;
  last?: boolean;
}>) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.gutter}>
        <ThemedText type="smallBold" style={styles.startTime}>{startLabel}</ThemedText>
        {endLabel ? <ThemedText type="small" themeColor="textMuted" style={styles.endTime}>{endLabel}</ThemedText> : null}
      </View>
      <View style={styles.spine}>
        <View style={[styles.spineStub, { backgroundColor: theme.border }]} />
        <View style={[styles.dot, { backgroundColor: kindColor }]} />
        {last ? null : <View style={[styles.spineLine, { backgroundColor: theme.border }]} />}
      </View>
      <View style={styles.content}>
        <View style={styles.head}>
          <ThemedText type="smallBold" style={styles.title}>{title}</ThemedText>
          <View style={[styles.pill, { backgroundColor: kindSoftColor }]}>
            <View style={[styles.pillDot, { backgroundColor: kindColor }]} />
            <ThemedText type="small" style={{ color: kindColor }}>{kindLabel}</ThemedText>
          </View>
        </View>
        {place ? <ThemedText type="small" themeColor="textSecondary">{place}</ThemedText> : null}
        {children}
      </View>
    </View>
  );
}

/** Travel between two plans. Lives in the gap so a plan row stays scannable. */
export function RouteSegment({ summary, trailing, children }: PropsWithChildren<{ summary: ReactNode; trailing?: ReactNode }>) {
  const theme = useTheme();
  return (
    <View style={styles.segment}>
      <View style={styles.gutter} />
      <View style={styles.spine}>
        <DashedSpine color={theme.borderField} />
      </View>
      <View style={styles.segmentContent}>
        <View style={styles.segmentSummary}>
          {summary}
          {trailing}
        </View>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'stretch' },
  segment: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'stretch' },
  daySeparator: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'stretch' },

  gutter: { width: Size.railGutter, alignItems: 'flex-end', paddingTop: 1, alignSelf: 'flex-start' },
  startTime: { fontVariant: ['tabular-nums'] },
  endTime: { fontSize: 12, lineHeight: 16, fontVariant: ['tabular-nums'] },

  spine: { width: SPINE_WIDTH, alignItems: 'center' },
  spineStub: { width: 2, height: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  spineLine: { width: 2, flex: 1, minHeight: 12, borderRadius: 1 },
  dashedSpine: { flex: 1, minHeight: Spacing.sm, overflow: 'hidden', alignItems: 'center' },
  routeDash: { position: 'absolute', width: 2, height: Spacing['2xs'] },

  content: { flex: 1, minWidth: 0, gap: 3, paddingBottom: 18 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, minWidth: 0, fontSize: 16, lineHeight: 22 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  pillDot: { width: 7, height: 7, borderRadius: 4 },

  segmentContent: { flex: 1, minWidth: 0, gap: 8, paddingTop: 2, paddingBottom: 14 },
  segmentSummary: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },

  dayCopy: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 2, paddingBottom: 10 },
  dayRule: { flex: 1, height: StyleSheet.hairlineWidth },
});
