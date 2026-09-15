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
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= Size.desktopBreakpoint;

  return (
    <Tabs style={styles.tabs}>
      <TabSlot style={[styles.tabSlot, desktop && styles.desktopSlot]} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton>{tx('今天', 'Today')}</TabButton>
          </TabTrigger>
          <TabTrigger name="itinerary" href={'/itinerary' as Href} asChild>
            <TabButton>{tx('安排', 'Plans')}</TabButton>
          </TabTrigger>
          <TabTrigger name="atlas" href={'/atlas' as Href} asChild>
            <TabButton>{tx('地图', 'Map')}</TabButton>
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
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= Size.desktopBreakpoint;

  return (
    <Pressable {...props} accessibilityRole="tab" accessibilityState={{ selected: Boolean(isFocused) }} aria-selected={Boolean(isFocused)} style={({ pressed }) => [styles.tabButton, desktop && styles.desktopTab, pressed && styles.pressed]}>
      <View style={[styles.tabButtonView, desktop && styles.desktopTabContent, isFocused && { backgroundColor: theme.backgroundSelected }]}>
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
  const desktop = Platform.OS === 'web' && width >= Size.desktopBreakpoint;
  const bottom = Platform.OS === 'web' ? Spacing.md : insets.bottom + Spacing.md;

  return (
    <View {...props} style={[styles.tabListContainer, { bottom }, desktop && styles.sidebar]}>
      <View
        style={[
          styles.innerContainer,
          compact && styles.innerContainerCompact,
          desktop && styles.sidebarInner,
          { backgroundColor: theme.navSurface, borderColor: theme.border, shadowColor: theme.shadow },
          desktop ? { backgroundColor: theme.backgroundElement } : Platform.OS === 'web' ? { boxShadow: theme.navShadow } : styles.nativeShadow,
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
  desktopSlot: { marginLeft: Size.sidebar },
  sidebar: { left: 0, right: undefined, top: 0, bottom: 0, width: Size.sidebar },
  sidebarInner: { height: '100%', maxWidth: Size.sidebar, borderRadius: 0, borderWidth: 0, borderRightWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.xl, paddingHorizontal: Spacing.sm, flexDirection: 'column', alignItems: 'stretch' },
  desktopTab: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', minHeight: Size.touchMin },
  desktopTabContent: { alignItems: 'flex-start', paddingHorizontal: Spacing.md },
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
    minHeight: Size.touchMin,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandText: { marginHorizontal: Spacing.xs },
  pressed: { opacity: 0.7 },
});
