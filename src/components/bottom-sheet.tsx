import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useTheme } from '@/hooks/use-theme';

interface BottomSheetProps extends PropsWithChildren {
  onDismiss: () => void;
  title: string;
  visible: boolean;
}

export function BottomSheet({ children, onDismiss, title, visible }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { tx } = useI18n();
  const theme = useTheme();

  if (!visible) return null;

  return (
    <Modal
      animationType="fade"
      navigationBarTranslucent
      onRequestClose={onDismiss}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}>
      <View style={styles.overlay}>
        <Pressable
          accessible={false}
          onPress={onDismiss}
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.sheetScrim }]}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
          pointerEvents="box-none"
          style={styles.keyboardAvoider}>
          <View
            accessibilityViewIsModal
            style={[styles.sheet, { backgroundColor: theme.backgroundElement, shadowColor: theme.shadow }]}
          >
            <View style={[styles.grabber, { backgroundColor: theme.borderField }]} />
            <View style={styles.header}>
              <ThemedText type="subtitle" style={styles.title}>{title}</ThemedText>
              <Pressable
                accessibilityLabel={tx('取消并关闭', 'Cancel and close')}
                accessibilityRole="button"
                hitSlop={6}
                onPress={onDismiss}
                style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
                <ThemedText type="smallBold" themeColor="textSecondary">{tx('取消', 'Cancel')}</ThemedText>
              </Pressable>
            </View>
            <ScrollView
              automaticallyAdjustKeyboardInsets
              contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) }]}
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              keyboardShouldPersistTaps="handled"
              style={styles.scroll}
              showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  keyboardAvoider: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  sheet: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '84%',
    alignSelf: 'center',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 10,
    paddingHorizontal: 20,
    gap: 10,
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: -8 },
    elevation: 16,
  },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  header: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { flex: 1, fontSize: 20, lineHeight: 26 },
  closeButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  scroll: { flexShrink: 1 },
  content: { width: '100%', gap: 14, paddingTop: 4 },
  pressed: { opacity: 0.68 },
});
