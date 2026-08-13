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
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === 'primary' && styles.primary,
        tone === 'secondary' && { backgroundColor: theme.backgroundSelected },
        tone === 'danger' && styles.danger,
        (pressed || isDisabled) && styles.dimmed,
      ]}>
      {busy ? (
        <ActivityIndicator color={tone === 'secondary' ? theme.text : '#FFFFFF'} />
      ) : (
        <ThemedText type="smallBold" style={tone === 'secondary' ? { color: theme.text } : styles.lightText}>
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
  role = 'checkbox',
  onPress,
}: PropsWithChildren<{ selected: boolean; disabled?: boolean; role?: 'checkbox' | 'radio' | 'tab'; onPress: () => void }>) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{ checked: role === 'checkbox' ? selected : undefined, selected: role !== 'checkbox' ? selected : undefined, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.chip, selected ? styles.chipSelected : { backgroundColor: theme.backgroundSelected }, disabled && styles.dimmed]}>
      <ThemedText type="smallBold" style={selected ? styles.lightText : { color: theme.text }}>
        {children}
      </ThemedText>
    </Pressable>
  );
}

export function InlineNotice({ children, tone = 'info' }: PropsWithChildren<{ tone?: 'info' | 'error' }>) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole={tone === 'error' ? 'alert' : 'text'}
      style={[styles.notice, { backgroundColor: theme.backgroundSelected }, tone === 'error' && { borderColor: theme.danger, borderWidth: 1 }]}
    >
      <ThemedText type="small" style={tone === 'error' ? { color: theme.danger } : undefined}>{children}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  input: { borderWidth: 1, borderRadius: 12, minHeight: 48, paddingHorizontal: 14, paddingVertical: 10 },
  button: { minHeight: 48, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: '#087F6A' },
  danger: { backgroundColor: '#B4413E' },
  dimmed: { opacity: 0.58 },
  lightText: { color: '#FFFFFF' },
  chip: { minHeight: 44, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center' },
  chipSelected: { backgroundColor: '#087F6A' },
  notice: { borderRadius: 12, padding: 12 },
});
