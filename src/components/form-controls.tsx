import type { PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export function FormField({ label, ...props }: TextInputProps & { label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        {...props}
        style={[
          styles.input,
          { color: theme.text, backgroundColor: theme.background, borderColor: theme.backgroundSelected },
          props.style,
        ]}
      />
    </View>
  );
}

export function ActionButton({
  children,
  onPress,
  busy = false,
  disabled = false,
  tone = 'primary',
}: PropsWithChildren<{
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  tone?: 'primary' | 'secondary' | 'danger';
}>) {
  const isDisabled = busy || disabled;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === 'primary' && styles.primary,
        tone === 'secondary' && styles.secondary,
        tone === 'danger' && styles.danger,
        (pressed || isDisabled) && styles.dimmed,
      ]}>
      {busy ? (
        <ActivityIndicator color={tone === 'secondary' ? '#12211D' : '#FFFFFF'} />
      ) : (
        <ThemedText type="smallBold" style={tone === 'secondary' ? styles.darkText : styles.lightText}>
          {children}
        </ThemedText>
      )}
    </Pressable>
  );
}

export function ChoiceChip({
  children,
  selected,
  disabled = false,
  onPress,
}: PropsWithChildren<{ selected: boolean; disabled?: boolean; onPress: () => void }>) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.chip, selected ? styles.chipSelected : styles.secondary, disabled && styles.dimmed]}>
      <ThemedText type="smallBold" style={selected ? styles.lightText : styles.darkText}>
        {children}
      </ThemedText>
    </Pressable>
  );
}

export function InlineNotice({ children, tone = 'info' }: PropsWithChildren<{ tone?: 'info' | 'error' }>) {
  return (
    <View style={[styles.notice, tone === 'error' ? styles.noticeError : styles.noticeInfo]}>
      <ThemedText type="small">{children}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  input: { borderWidth: 1, borderRadius: 12, minHeight: 48, paddingHorizontal: 14, paddingVertical: 10 },
  button: { minHeight: 48, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: '#087F6A' },
  secondary: { backgroundColor: '#E2F0EC' },
  danger: { backgroundColor: '#B4413E' },
  dimmed: { opacity: 0.58 },
  lightText: { color: '#FFFFFF' },
  darkText: { color: '#12211D' },
  chip: { minHeight: 44, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center' },
  chipSelected: { backgroundColor: '#087F6A' },
  notice: { borderRadius: 12, padding: 12 },
  noticeInfo: { backgroundColor: '#E2F0EC' },
  noticeError: { backgroundColor: '#F7D9D7' },
});
