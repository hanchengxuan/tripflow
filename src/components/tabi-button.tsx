import { usePathname } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { floatingActionBottom } from '@/components/screen';
import { TripChatSheet } from '@/components/trip-chat-sheet';
import { Size } from '@/constants/theme';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useMvp } from '@/features/mvp/mvp-provider';
import { useTheme } from '@/hooks/use-theme';

const size = 48;

/** 小途 (Tabi): one floating entry on every tab, sitting above each screen's own floating action. */
export function TabiButton() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { tx } = useI18n();
  const pathname = usePathname();
  const { activeTrip, members, currentUserId } = useMvp();
  const [open, setOpen] = useState(false);
  if (!activeTrip) return null;

  const role = members.find(({ userId }) => userId === currentUserId)?.role;
  // Mirrors where screens render their own "+" button, so Tabi stacks above it or takes its place.
  const screenHasAction = pathname === '/ledger' || ((pathname === '/' || pathname === '/itinerary') && (role === 'owner' || role === 'editor'));
  const bottom = floatingActionBottom(insets.bottom, width) + (screenHasAction ? Size.fab + 14 : (Size.fab - size) / 2);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tx('问小途', 'Ask Tabi')}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.button,
          { bottom, backgroundColor: theme.backgroundElement, borderColor: theme.accentSoft, shadowColor: theme.shadow },
          pressed && styles.pressed,
        ]}>
        <SymbolView name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }} size={22} tintColor={theme.accent} />
      </Pressable>
      <TripChatSheet key={activeTrip.id} visible={open} onDismiss={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 20 + (Size.fab - size) / 2,
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 11,
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  pressed: { opacity: 0.8 },
});
