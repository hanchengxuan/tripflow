import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useTheme } from '@/hooks/use-theme';

/** Grey outlines of a card and a few rows, shown while a screen's first data loads. */
export function ContentSkeleton() {
  const theme = useTheme();
  const { tx } = useI18n();
  const [opacity] = useState(() => new Animated.Value(0.55));

  useEffect(() => {
    let pulse: Animated.CompositeAnimation | undefined;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce || cancelled) return;
      pulse = Animated.loop(Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      ]));
      pulse.start();
    });
    return () => {
      cancelled = true;
      pulse?.stop();
    };
  }, [opacity]);

  const block = { backgroundColor: theme.backgroundSelected };
  return (
    <Animated.View accessibilityRole="progressbar" accessibilityLabel={tx('正在加载', 'Loading')} style={[styles.wrap, { opacity }]}>
      <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        <View style={[styles.pill, block]} />
        <View style={[styles.title, block]} />
        <View style={[styles.line, block]} />
      </View>
      {[0, 1, 2].map((row) => (
        <View key={row} style={styles.row}>
          <View style={[styles.dot, block]} />
          <View style={styles.rowCopy}>
            <View style={[styles.rowTitle, block]} />
            <View style={[styles.rowLine, block]} />
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.lg },
  card: { borderRadius: Radius['2xl'], padding: Spacing.lg, gap: Spacing.md },
  pill: { width: 72, height: 24, borderRadius: Radius.pill },
  title: { width: '70%', height: 30, borderRadius: Radius.sm },
  line: { width: '50%', height: 16, borderRadius: Radius.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  dot: { width: 36, height: 36, borderRadius: 18 },
  rowCopy: { flex: 1, gap: Spacing.xs },
  rowTitle: { width: '60%', height: 16, borderRadius: Radius.sm },
  rowLine: { width: '40%', height: 12, borderRadius: Radius.sm },
});
