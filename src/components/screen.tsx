import { useEffect, useRef, type PropsWithChildren } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

interface ScreenProps extends PropsWithChildren {
  meta?: string;
  scrollToEndKey?: string;
  title: string;
  subtitle: string;
}

export function Screen({ meta, scrollToEndKey, title, subtitle, children }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!scrollToEndKey) return;
    const timeout = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 0);
    return () => clearTimeout(timeout);
  }, [scrollToEndKey]);

  return (
    <ScrollView
      ref={scrollRef}
      style={[styles.scroll, { backgroundColor: theme.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + (Platform.OS === 'web' ? 104 : 20),
          paddingBottom: insets.bottom + 104,
        },
      ]}>
      <View style={styles.header}>
        <ThemedText type="subtitle">{title}</ThemedText>
        <ThemedText themeColor="textSecondary">{subtitle}</ThemedText>
        {meta ? <ThemedText type="small" themeColor="textSecondary">{meta}</ThemedText> : null}
      </View>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 20, gap: 16 },
  header: { gap: 6, marginBottom: 8 },
});
