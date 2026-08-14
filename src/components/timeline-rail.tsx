import type { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/**
 * The shared time rail.
 *
 * Times sit in a fixed gutter so every title starts on the same axis, and a
 * continuous spine runs the whole day. Travel between two plans belongs in
 * `RouteSegment`, which occupies the gap rather than nesting inside a row.
 */

const GUTTER_WIDTH = 46;
const SPINE_WIDTH = 12;

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
        <View style={styles.dotSlot}>
          <View style={[styles.dot, { backgroundColor: kindColor }]} />
        </View>
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
        <View style={[styles.spineLine, styles.spineLineRoute, { backgroundColor: theme.borderField }]} />
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
  row: { flexDirection: 'row', gap: 12, alignItems: 'stretch', paddingBottom: 18 },
  segment: { flexDirection: 'row', gap: 12, alignItems: 'stretch', paddingBottom: 14 },
  daySeparator: { flexDirection: 'row', gap: 12, alignItems: 'stretch', paddingBottom: 10 },

  gutter: { width: GUTTER_WIDTH, alignItems: 'flex-end', paddingTop: 1 },
  startTime: { fontVariant: ['tabular-nums'] },
  endTime: { fontSize: 12, lineHeight: 16, fontVariant: ['tabular-nums'] },

  spine: { width: SPINE_WIDTH, alignItems: 'center' },
  dotSlot: { height: 20, justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  spineLine: { width: 2, flex: 1, minHeight: 12, borderRadius: 1 },
  spineLineRoute: { opacity: 0.7 },

  content: { flex: 1, minWidth: 0, gap: 3 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, minWidth: 0, fontSize: 16, lineHeight: 22 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  pillDot: { width: 7, height: 7, borderRadius: 4 },

  segmentContent: { flex: 1, minWidth: 0, gap: 8, paddingTop: 2 },
  segmentSummary: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },

  dayCopy: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 2 },
  dayRule: { flex: 1, height: StyleSheet.hairlineWidth },
});
