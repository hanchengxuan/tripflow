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
import { Radius, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function FormField({ label, ...props }: TextInputProps & { label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</ThemedText>
      <TextInput
        placeholderTextColor={theme.textMuted}
        {...props}
        style={[
          styles.input,
          { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.borderField },
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
        tone === 'primary' && { backgroundColor: pressed ? theme.accentPressed : theme.accent },
        tone === 'secondary' && { backgroundColor: theme.accentSoft },
        tone === 'danger' && { backgroundColor: theme.danger },
        (pressed || isDisabled) && styles.dimmed,
      ]}>
      {busy ? (
        <ActivityIndicator color={tone === 'secondary' ? theme.text : theme.textOnAccent} />
      ) : (
        <ThemedText style={[styles.buttonLabel, { color: tone === 'secondary' ? theme.text : theme.textOnAccent }]}>
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
      accessibilityState={{ checked: role === 'checkbox' || role === 'radio' ? selected : undefined, selected: role === 'tab' ? selected : undefined, disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? theme.accent : theme.backgroundSubtle }, disabled && styles.dimmed]}>
      <ThemedText style={[styles.chipLabel, selected && styles.chipLabelSelected, { color: selected ? theme.textOnAccent : theme.text }]}>
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
      style={[styles.notice, { backgroundColor: tone === 'error' ? theme.dangerSoft : theme.accentSoft }]}
    >
      <View style={[styles.noticeAccent, { backgroundColor: tone === 'error' ? theme.danger : theme.accent }]} />
      <ThemedText type="small" style={[styles.noticeCopy, tone === 'error' ? { color: theme.danger } : null]}>{children}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  fieldLabel: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    minHeight: Size.control,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
  },
  button: {
    minHeight: Size.control,
    borderRadius: Radius.md,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: { fontSize: 16, lineHeight: 22, fontWeight: '500' },
  dimmed: { opacity: 0.58 },
  chip: { height: 36, borderRadius: Radius.pill, paddingHorizontal: 14, justifyContent: 'center' },
  chipLabel: { fontSize: 14, lineHeight: 18, fontWeight: '500' },
  chipLabelSelected: { fontWeight: '600' },
  notice: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  noticeAccent: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  noticeCopy: { flex: 1, minWidth: 0 },
});
