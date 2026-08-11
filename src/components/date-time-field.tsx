import { DateTimePicker as ExpoDateTimePicker } from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

type PickerMode = 'date' | 'time';

function parseValue(value: string, mode: PickerMode) {
  const parsed = mode === 'date' ? new Date(`${value}T12:00:00`) : new Date(`2000-01-01T${value}:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function formatValue(date: Date, mode: PickerMode) {
  const pad = (value: number) => String(value).padStart(2, '0');
  if (mode === 'time') return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function DateTimeField({
  label,
  value,
  mode,
  onChange,
  minimumDate,
}: {
  label: string;
  value: string;
  mode: PickerMode;
  onChange: (value: string) => void;
  minimumDate?: Date;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const picker = (
    <ExpoDateTimePicker
      value={parseValue(value, mode)}
      mode={mode}
      locale="zh_CN"
      is24Hour
      minimumDate={minimumDate}
      display={Platform.OS === 'ios' ? 'compact' : 'default'}
      positiveButton={{ label: '确定' }}
      negativeButton={{ label: '取消' }}
      onDismiss={() => setOpen(false)}
      onValueChange={(_event, date) => {
        onChange(formatValue(date, mode));
        if (Platform.OS === 'android') setOpen(false);
      }}
    />
  );

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      {Platform.OS === 'ios' ? (
        <View style={[styles.iosControl, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
          {picker}
        </View>
      ) : (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${label}：${value}`}
            onPress={() => setOpen(true)}
            style={[styles.control, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
            <ThemedText>{value}</ThemedText>
            <ThemedText themeColor="textSecondary">选择 ›</ThemedText>
          </Pressable>
          {open ? picker : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  control: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iosControl: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, justifyContent: 'center' },
});
