import { createElement, type ChangeEvent } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export function DateTimeField({
  label,
  value,
  mode,
  onChange,
  minimumDate,
}: {
  label: string;
  value: string;
  mode: 'date' | 'time';
  onChange: (value: string) => void;
  minimumDate?: Date;
}) {
  const theme = useTheme();
  const minimum = minimumDate?.toISOString().slice(0, 10);
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      {createElement('input', {
        type: mode,
        value,
        min: mode === 'date' ? minimum : undefined,
        onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
        'aria-label': label,
        style: {
          minHeight: 48,
          border: `1px solid ${theme.backgroundSelected}`,
          borderRadius: 12,
          padding: '10px 14px',
          color: theme.text,
          background: theme.background,
          font: 'inherit',
          boxSizing: 'border-box',
          width: '100%',
        },
      })}
    </View>
  );
}

const styles = StyleSheet.create({ field: { gap: 6 } });
