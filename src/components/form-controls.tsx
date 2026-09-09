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

export function FormField({ label, prominent = false, ...props }: TextInputProps & { label: string; prominent?: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</ThemedText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.textMuted}
        {...props}
        style={[
          styles.input,
          prominent && styles.amountInput,
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
  size = 'regular',
}: PropsWithChildren<{
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  tone?: 'primary' | 'secondary' | 'danger';
  size?: 'regular' | 'compact';
}>) {
  const isDisabled = busy || disabled;
  const theme = useTheme();
  const labelColor = tone === 'danger' ? theme.textOnDanger : tone === 'secondary' ? theme.text : theme.textOnAccent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        size === 'compact' && styles.compactButton,
        tone === 'primary' && { backgroundColor: pressed ? theme.accentPressed : theme.accent },
        tone === 'secondary' && { backgroundColor: theme.backgroundSubtle },
        tone === 'danger' && { backgroundColor: theme.danger },
        (pressed || isDisabled) && styles.dimmed,
      ]}>
      {busy ? (
        <ActivityIndicator color={labelColor} />
      ) : (
        <ThemedText style={[styles.buttonLabel, size === 'compact' && styles.compactLabel, { color: labelColor }]}>
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
  field: { gap: 6, minWidth: 0 },
  fieldLabel: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    minHeight: Size.control,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    lineHeight: 24,
  },
  amountInput: { minHeight: Size.amountControl, fontSize: 28, lineHeight: 36, fontWeight: '600', fontVariant: ['tabular-nums'] },
  compactButton: { minHeight: Size.touchMin, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  compactLabel: { fontSize: 14, lineHeight: 20 },
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
