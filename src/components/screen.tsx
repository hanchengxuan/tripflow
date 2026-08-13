import { useEffect, useRef, type PropsWithChildren, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
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
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!scrollToEndKey) return;
    const timeout = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 0);
    return () => clearTimeout(timeout);
  }, [scrollToEndKey]);

  useEffect(() => {
    if (!scrollToKey || scrollToOffset === undefined) return;
    const timeout = setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, scrollToOffset - 16), animated: true }), 0);
    return () => clearTimeout(timeout);
  }, [scrollToKey, scrollToOffset]);

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
        <View style={styles.header}>
          <ThemedText type="subtitle">{title}</ThemedText>
          <ThemedText themeColor="textSecondary">{subtitle}</ThemedText>
          {meta ? <ThemedText type="small" themeColor="textSecondary">{meta}</ThemedText> : null}
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
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 20, gap: 16 },
  header: { gap: 6, marginBottom: 8 },
  floatingAction: { position: 'absolute', right: 20, zIndex: 10 },
});
