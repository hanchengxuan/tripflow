import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Chevron } from '@/components/chevron';
import { ThemedText } from '@/components/themed-text';
import { TripChatSheet } from '@/components/trip-chat-sheet';
import { Radius, Spacing } from '@/constants/theme';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useTheme } from '@/hooks/use-theme';

export function TripChatEntry() {
  const theme = useTheme();
  const { tx } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tx('打开行程助手', 'Open the trip assistant')}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.row, { backgroundColor: theme.backgroundElement, borderColor: theme.border }, pressed && styles.pressed]}>
        <View style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
          <ThemedText type="smallBold" style={{ color: theme.accent }}>AI</ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={styles.grow} numberOfLines={1}>
          {tx('问行程，或让助手帮你改安排、记账', 'Ask about the trip, or have the assistant change plans or log expenses')}
        </ThemedText>
        <Chevron color={theme.textSecondary} direction="right" />
      </Pressable>
      <TripChatSheet visible={open} onDismiss={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 48, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  badge: { borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  grow: { flex: 1 },
  pressed: { opacity: 0.75 },
});
