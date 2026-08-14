import type { Href } from 'expo-router';
import {
  Tabs,
  TabList,
  TabSlot,
  TabTrigger,
  type TabListProps,
  type TabTriggerSlotProps,
} from 'expo-router/ui';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Radius, Size, Spacing } from '@/constants/theme';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useTheme } from '@/hooks/use-theme';

export default function AppTabsCustom() {
  const { tx } = useI18n();

  return (
    <Tabs style={styles.tabs}>
      <TabSlot style={styles.tabSlot} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton>{tx('今天', 'Today')}</TabButton>
          </TabTrigger>
          <TabTrigger name="explore" href="/explore" asChild>
            <TabButton>{tx('行程', 'Trips')}</TabButton>
          </TabTrigger>
          <TabTrigger name="ledger" href="/ledger" asChild>
            <TabButton>{tx('账本', 'Ledger')}</TabButton>
          </TabTrigger>
          <TabTrigger name="profile" href={'/profile' as Href} asChild>
            <TabButton>{tx('我的', 'Me')}</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  const theme = useTheme();

  return (
    <Pressable {...props} style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}>
      <View style={[styles.tabButtonView, isFocused && { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="small" themeColor={isFocused ? 'accentOnSoft' : 'textSecondary'}>
          {children}
        </ThemedText>
      </View>
    </Pressable>
  );
}

function CustomTabList(props: TabListProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const compact = width < 440;
  const bottom = Platform.OS === 'web' ? Spacing.md : insets.bottom + Spacing.md;

  return (
    <View {...props} style={[styles.tabListContainer, { bottom }]}>
      <View
        style={[
          styles.innerContainer,
          compact && styles.innerContainerCompact,
          { backgroundColor: theme.navSurface, borderColor: theme.border, shadowColor: theme.shadow },
          Platform.OS === 'web' ? { boxShadow: theme.navShadow } : styles.nativeShadow,
        ]}>
        {!compact ? <ThemedText type="smallBold" style={styles.brandText}>TripFlow</ThemedText> : null}
        {props.children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flex: 1 },
  tabSlot: { flex: 1, minHeight: 0 },
  tabListContainer: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    alignItems: 'center',
    zIndex: 20,
  },
  innerContainer: {
    width: '100%',
    maxWidth: 520,
    height: Size.nav,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  innerContainerCompact: { gap: Spacing['2xs'] },
  nativeShadow: {
    shadowOpacity: 0.12,
    shadowRadius: Spacing.lg,
    shadowOffset: { width: 0, height: Spacing.xs },
    elevation: 8,
  },
  tabButton: { flex: 1, minWidth: 0 },
  tabButtonView: {
    minHeight: Size.touchMin - Spacing['2xs'],
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandText: { marginHorizontal: Spacing.xs },
  pressed: { opacity: 0.7 },
});
