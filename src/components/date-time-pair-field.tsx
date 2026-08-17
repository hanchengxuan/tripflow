import { StyleSheet, View } from 'react-native';

import { DateTimeField } from '@/components/date-time-field';
import { ThemedText } from '@/components/themed-text';
import { Radius, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * One labelled control holding a date and a time.
 *
 * Deliberately platform-neutral: only the leaf `DateTimeField` has a `.web`
 * override, so this composition can never drift between platforms the way it
 * did when it lived inside the native-only module.
 */
export function DateTimePairField({
  label,
  dateLabel,
  dateValue,
  timeLabel,
  timeValue,
  onDateChange,
  onTimeChange,
  stacked = false,
}: {
  label: string;
  dateLabel: string;
  dateValue: string;
  timeLabel: string;
  timeValue: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  /** Set when the parent lays the pairs out in a column; see `pairFieldStacked`. */
  stacked?: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.pairField, stacked && styles.pairFieldStacked]}>
      <ThemedText type="smallBold" themeColor="textSecondary">{label}</ThemedText>
      <View style={[styles.pairControl, { backgroundColor: theme.backgroundElement, borderColor: theme.borderField }]}>
        <View style={styles.datePart}>
          <DateTimeField embedded label={dateLabel} mode="date" onChange={onDateChange} value={dateValue} />
        </View>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <View style={styles.timePart}>
          <DateTimeField embedded label={timeLabel} mode="time" onChange={onTimeChange} value={timeValue} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Explicit basis/width keeps the two combined controls measurable on iOS.
  // Without it, a native ScrollView can resolve the percentage parent width as
  // zero and each picker collapses to the width of its digits.
  pairField: { flexGrow: 1, flexShrink: 1, flexBasis: 0, width: 0, minWidth: 0, gap: Spacing.xs },
  // Flex basis is main-axis, so the row values above turn into a zero height
  // once the parent flips to a column. Reset them rather than inherit a
  // collapsed control.
  pairFieldStacked: { flexGrow: 0, flexBasis: 'auto', width: '100%' },
  pairControl: {
    minHeight: Size.control,
    borderWidth: 1,
    borderRadius: Radius.sm,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
  },
  datePart: { flex: 1.35, minWidth: 0 },
  timePart: { flex: 0.85, minWidth: 0 },
  divider: { width: StyleSheet.hairlineWidth, marginVertical: Spacing.sm },
});
