import { DateTimePicker as ExpoDateTimePicker } from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Chevron } from '@/components/chevron';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/features/i18n/i18n-provider';

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

function formatDisplayValue(value: string, mode: PickerMode, locale: string) {
  const parsed = parseValue(value, mode);
  if (mode === 'time') {
    return parsed.toLocaleTimeString(locale === 'zh-CN' ? 'zh-CN' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  return parsed.toLocaleDateString(locale === 'zh-CN' ? 'zh-CN' : 'en-US', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  });
}

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
  mode: PickerMode;
  onChange: (value: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  embedded?: boolean;
}) {
  const theme = useTheme();
  const { locale, tx } = useI18n();
  const [open, setOpen] = useState(false);
  const displayValue = formatDisplayValue(value, mode, locale);
  const picker = open ? (
    <ExpoDateTimePicker
      value={parseValue(value, mode)}
      mode={mode}
      locale={locale === 'zh-CN' ? 'zh_CN' : 'en_US'}
      is24Hour
      minimumDate={minimumDate}
      maximumDate={maximumDate}
      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
      positiveButton={{ label: tx('确定', 'Done') }}
      negativeButton={{ label: tx('取消', 'Cancel') }}
      onDismiss={() => setOpen(false)}
      onValueChange={(_event, date) => {
        onChange(formatValue(date, mode));
        setOpen(false);
      }}
    />
  ) : null;

  return (
    <View style={[styles.field, embedded && styles.embeddedField]}>
      {!embedded ? <ThemedText type="smallBold">{label}</ThemedText> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}：${displayValue}`}
        onPress={() => setOpen(true)}
        style={[
          styles.control,
          embedded && styles.embeddedControl,
          { backgroundColor: embedded ? theme.backgroundElement : theme.background, borderColor: theme.borderField },
        ]}
      >
        <View style={styles.copy}>
          <ThemedText type="smallBold" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
            {displayValue}
          </ThemedText>
        </View>
        {!embedded ? <Chevron color={theme.textSecondary} /> : null}
      </Pressable>
      {picker}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  embeddedField: { flex: 1, minWidth: 0, gap: 0 },
  control: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  embeddedControl: {
    minHeight: 46,
    borderWidth: 0,
    borderRadius: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  copy: { flex: 1, gap: 2 },
});
