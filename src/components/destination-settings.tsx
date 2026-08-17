import { Pressable, StyleSheet, View } from 'react-native';

import { Chevron } from '@/components/chevron';
import { SelectionField } from '@/components/selection-field';
import { ThemedText } from '@/components/themed-text';
import { Radius, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Time zone and currency, derived rather than asked for.
 *
 * Choosing a destination already determines both, so they are shown as a
 * summary the traveller can confirm at a glance and only opened when something
 * needs correcting. Two pickers in the primary flow made every trip start with
 * a quiz about IANA zone names.
 */
export function DestinationSettings({
  currency,
  currencyOptions,
  onCurrencyChange,
  onTimeZoneChange,
  onToggle,
  open,
  placeLabel,
  timeZone,
  timeZoneOptions,
  tx,
}: {
  currency: string;
  currencyOptions: { label: string; value: string }[];
  onCurrencyChange: (value: string) => void;
  onTimeZoneChange: (value: string) => void;
  onToggle: () => void;
  open: boolean;
  placeLabel?: string;
  timeZone: string;
  timeZoneOptions: { label: string; value: string }[];
  tx: (zh: string, en: string) => string;
}) {
  const theme = useTheme();
  // A persisted value can sit outside the offered list; keep it selectable so
  // opening the row never silently rewrites what was saved.
  const resolvedCurrencyOptions = currencyOptions.some((option) => option.value === currency)
    ? currencyOptions
    : [{ value: currency, label: currency }, ...currencyOptions];
  const resolvedTimeZoneOptions = timeZoneOptions.some((option) => option.value === timeZone)
    ? timeZoneOptions
    : [{ value: timeZone, label: timeZone }, ...timeZoneOptions];

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        style={({ pressed }) => [styles.summary, pressed && styles.pressed]}>
        <View style={styles.summaryCopy}>
          <ThemedText type="smallBold">{tx('已自动设置', 'Set automatically')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {[placeLabel, timeZone, currency].filter(Boolean).join(' · ')}
          </ThemedText>
        </View>
        <Chevron color={theme.textSecondary} direction={open ? 'down' : 'right'} />
      </Pressable>
      {open ? (
        <View style={[styles.fields, { backgroundColor: theme.backgroundSubtle }]}>
          <View style={styles.field}>
            <SelectionField label={tx('时区', 'Time zone')} value={timeZone} options={resolvedTimeZoneOptions} onChange={onTimeZoneChange} />
          </View>
          <View style={styles.field}>
            <SelectionField label={tx('记账币种', 'Home currency')} value={currency} options={resolvedCurrencyOptions} onChange={onCurrencyChange} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs },
  summary: { minHeight: Size.control, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing['2xs'] },
  summaryCopy: { flex: 1, minWidth: 0, gap: 1 },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, padding: Spacing.sm, borderRadius: Radius.md },
  field: { flexGrow: 1, flexShrink: 1, flexBasis: 200, minWidth: 0 },
  pressed: { opacity: 0.68 },
});
