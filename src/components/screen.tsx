import type { PropsWithChildren, ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

const WEB_NAV_CLEARANCE = 112;
const WEB_ACTION_OFFSET = 92;

interface ScreenProps extends PropsWithChildren {
  context: readonly string[];
  floatingAction?: ReactNode;
  title: string;
}

export function Screen({ context, floatingAction, title, children }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 520;
  return (
    <View style={[styles.frame, { backgroundColor: theme.background }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + (Platform.OS === 'web' ? 24 : 20),
            paddingBottom: insets.bottom + (Platform.OS === 'web' ? WEB_NAV_CLEARANCE : 104),
          },
        ]}>
        <View style={[styles.header, compact && styles.headerCompact]}>
          <ThemedText type="subtitle" style={[styles.screenTitle, compact && styles.screenTitleCompact]}>{title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.contextRow}>{context.join(' · ')}</ThemedText>
        </View>
        {children}
      </ScrollView>
      {floatingAction ? <View style={[styles.floatingAction, { bottom: insets.bottom + (Platform.OS === 'web' ? WEB_ACTION_OFFSET : 84) }]}>{floatingAction}</View> : null}
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
  contextRow: { flexWrap: 'wrap' },
  floatingAction: { position: 'absolute', right: 20, zIndex: 10 },
});
