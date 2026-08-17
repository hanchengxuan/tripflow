import { createElement, type ChangeEvent } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Size } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Web leaf control. Must keep the same public props as the native module —
 * `DateTimePairField` composes this on both platforms, and Metro swaps the
 * implementations silently, so a missing prop here fails only at runtime.
 */
export function DateTimeField({
  label,
  value,
  mode,
  onChange,
  minimumDate,
  maximumDate,
  embedded = false,
}: {
  label: string;
  value: string;
  mode: 'date' | 'time';
  onChange: (value: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  embedded?: boolean;
}) {
  const theme = useTheme();
  const isDate = mode === 'date';
  const minimum = isDate ? minimumDate?.toISOString().slice(0, 10) : undefined;
  const maximum = isDate ? maximumDate?.toISOString().slice(0, 10) : undefined;

  return (
    <View style={[styles.field, embedded && styles.embeddedField]}>
      {!embedded ? <ThemedText type="smallBold">{label}</ThemedText> : null}
      {createElement('input', {
        type: mode,
        value,
        min: minimum,
        max: maximum,
        onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
        'aria-label': label,
        style: {
          minHeight: embedded ? 46 : Size.control,
          border: embedded ? 'none' : `1px solid ${theme.borderField}`,
          borderRadius: embedded ? 0 : Radius.sm,
          padding: embedded ? '8px 10px' : '10px 14px',
          color: theme.text,
          background: embedded ? theme.backgroundElement : theme.background,
          // 16px keeps mobile Safari from zooming the page on focus.
          font: 'inherit',
          fontSize: 16,
          fontWeight: 600,
          boxSizing: 'border-box',
          width: '100%',
        },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  embeddedField: { flex: 1, minWidth: 0, gap: 0 },
});
