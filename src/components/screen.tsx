import { useCallback, useEffect, useRef, type PropsWithChildren, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

interface ScreenProps extends PropsWithChildren {
  floatingAction?: ReactNode;
  meta?: string;
  scrollToKey?: string;
  scrollToOffset?: number;
  scrollToEndKey?: string;
  title: string;
  subtitle: string;
}

export function Screen({ floatingAction, meta, scrollToKey, scrollToOffset, scrollToEndKey, title, subtitle, children }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 520;
  const scrollRef = useRef<ScrollView>(null);
  const scrollToTarget = useCallback(() => {
    if (!scrollToKey || scrollToOffset === undefined) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, scrollToOffset - 16), animated: true });
  }, [scrollToKey, scrollToOffset]);

  useEffect(() => {
    if (!scrollToEndKey) return;
    const timeout = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 0);
    return () => clearTimeout(timeout);
  }, [scrollToEndKey]);

  useEffect(() => {
    if (!scrollToKey || scrollToOffset === undefined) return;
    let secondFrame = 0;
    const frame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(scrollToTarget);
    });
    return () => {
      cancelAnimationFrame(frame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
    };
  }, [scrollToKey, scrollToOffset, scrollToTarget]);

  return (
    <View style={[styles.frame, { backgroundColor: theme.background }]}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + (Platform.OS === 'web' ? 24 : 20),
            paddingBottom: insets.bottom + (Platform.OS === 'web' ? 40 : 104),
          },
        ]}>
        <View style={[styles.header, compact && styles.headerCompact]}>
          <ThemedText type="subtitle" style={[styles.screenTitle, compact && styles.screenTitleCompact]}>{title}</ThemedText>
          <View style={styles.contextRow}>
            <ThemedText type="small" themeColor="textSecondary">{subtitle}</ThemedText>
            {meta ? <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{meta}</ThemedText> : null}
          </View>
        </View>
        {children}
      </ScrollView>
      {floatingAction ? <View style={[styles.floatingAction, { bottom: insets.bottom + (Platform.OS === 'web' ? 24 : 84) }]}>{floatingAction}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
  scroll: { flex: 1 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 20, gap: 18 },
  header: { gap: 4, marginBottom: 4 },
  headerCompact: { marginBottom: 2 },
  screenTitle: { fontSize: 30, lineHeight: 38 },
  screenTitleCompact: { fontSize: 28, lineHeight: 34 },
  contextRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, rowGap: 2 },
  floatingAction: { position: 'absolute', right: 20, zIndex: 10 },
});
