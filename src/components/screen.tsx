import type { PropsWithChildren, ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Size } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const WEB_NAV_CLEARANCE = 112;
const WEB_ACTION_OFFSET = 92;

interface ScreenProps extends PropsWithChildren {
  context: readonly string[];
  /**
   * Hands the children every pixel below the header instead of a scroll view.
   * The map is the one surface that wants this: a viewport inside a scrolling
   * page can only ever be as tall as its own aspect ratio allows, which on a
   * phone left the map at roughly a quarter of the frame.
   */
  fill?: boolean;
  floatingAction?: ReactNode;
  title: string;
}

export function Screen({ context, fill = false, floatingAction, title, children }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 520;
  const paddingTop = insets.top + (Platform.OS === 'web' ? 24 : 20);
  const paddingBottom = insets.bottom + (Platform.OS === 'web' ? WEB_NAV_CLEARANCE : 104);
  const header = (
    <View style={[styles.header, compact && styles.headerCompact]}>
      <ThemedText type="subtitle" style={styles.screenTitle}>{title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.contextRow}>{context.join(' · ')}</ThemedText>
    </View>
  );
  return (
    <View style={[styles.frame, { backgroundColor: theme.background }]}>
      {fill ? (
        <View style={[styles.content, styles.filled, { paddingTop, paddingBottom }]}>
          {header}
          {children}
        </View>
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingTop, paddingBottom }]}>
          {header}
          {children}
        </ScrollView>
      )}
      {floatingAction ? <View style={[styles.floatingAction, { bottom: insets.bottom + (Platform.OS === 'web' ? WEB_ACTION_OFFSET : Size.fabClearance) }]}>{floatingAction}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
  scroll: { flex: 1 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 20, gap: 18 },
  filled: { flex: 1, minHeight: 0 },
  header: { gap: 4, marginBottom: 4 },
  headerCompact: { marginBottom: 2 },
  screenTitle: { fontSize: 28, lineHeight: 34, letterSpacing: -0.4 },
  contextRow: { flexWrap: 'wrap' },
  floatingAction: { position: 'absolute', right: 20, zIndex: 10 },
});
