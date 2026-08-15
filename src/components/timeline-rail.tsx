import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { KindPill } from '@/components/kind-pill';
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
  onPress,
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
  onPress?: () => void;
}>) {
  const theme = useTheme();
  const body = (
    <>
      <View style={styles.head}>
        <ThemedText type="smallBold" style={styles.title}>{title}</ThemedText>
        <KindPill color={kindColor} softColor={kindSoftColor} label={kindLabel} />
      </View>
      {place ? <ThemedText type="small" themeColor="textSecondary">{place}</ThemedText> : null}
      {children}
    </>
  );
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
      {onPress ? (
        <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.content, pressed && styles.pressed]}>{body}</Pressable>
      ) : <View style={styles.content}>{body}</View>}
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
  row: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  segment: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  daySeparator: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },

  gutter: { width: GUTTER_WIDTH, alignItems: 'flex-end', paddingTop: 1, alignSelf: 'flex-start' },
  startTime: { fontVariant: ['tabular-nums'] },
  endTime: { fontSize: 12, lineHeight: 16, fontVariant: ['tabular-nums'] },

  spine: { width: SPINE_WIDTH, alignItems: 'center' },
  spineStub: { width: 2, height: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  spineLine: { width: 2, flex: 1, minHeight: 12, borderRadius: 1 },
  spineLineRoute: { opacity: 0.7 },

  content: { flex: 1, minWidth: 0, gap: 3, paddingBottom: 18 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, minWidth: 0, fontSize: 16, lineHeight: 22 },
  pressed: { opacity: 0.68 },

  segmentContent: { flex: 1, minWidth: 0, gap: 8, paddingTop: 2, paddingBottom: 14 },
  segmentSummary: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },

  dayCopy: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 2, paddingBottom: 10 },
  dayRule: { flex: 1, height: StyleSheet.hairlineWidth },
});
