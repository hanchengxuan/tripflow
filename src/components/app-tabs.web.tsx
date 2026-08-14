import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import type { Href } from 'expo-router';
import { Pressable, View, StyleSheet, useWindowDimensions } from 'react-native';

import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useTheme } from '@/hooks/use-theme';

export default function AppTabs() {
  const { tx } = useI18n();
  return (
    <Tabs>
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
      <TabSlot style={styles.tabSlot} />
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  const theme = useTheme();

  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <View
        style={[
          styles.tabButtonView,
          isFocused && { backgroundColor: theme.backgroundSelected },
        ]}>
        <ThemedText type="small" themeColor={isFocused ? 'accentOnSoft' : 'textSecondary'}>
          {children}
        </ThemedText>
      </View>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const compact = width < 440;

  return (
    <View {...props} style={[styles.tabListContainer, compact && styles.tabListContainerCompact]}>
      <View
        style={[
          styles.innerContainer,
          compact && styles.innerContainerCompact,
          { backgroundColor: theme.navSurface, boxShadow: theme.navShadow },
          styles.glassEffect,
        ]}>
        {!compact ? (
          <ThemedText type="smallBold" style={styles.brandText}>
            TripFlow
          </ThemedText>
        ) : null}

        {props.children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    width: '100%',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 16,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    zIndex: 20,
  },
  tabListContainerCompact: { bottom: 12, paddingHorizontal: 12 },
  innerContainer: {
    width: '100%',
    maxWidth: 520,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  innerContainerCompact: { paddingHorizontal: 6, justifyContent: 'space-between', gap: 0 },
  glassEffect: {
    // React Native Web prefixes backdropFilter for browsers that need it.
    backdropFilter: 'blur(18px) saturate(145%)',
  },
  tabSlot: { flex: 1, minHeight: 0 },
  brandText: {
    marginHorizontal: 8,
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    minHeight: 40,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
