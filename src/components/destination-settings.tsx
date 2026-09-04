import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/**
 * What choosing a destination decided, stated as a fact.
 *
 * This used to be a disclosure hiding two pickers — an IANA time zone and a
 * currency. Neither was a question worth asking. A destination carries its own
 * zone from the geocoder and the device knows its own, so the app can always
 * answer the time-zone question itself; and the currency shown here was the
 * ledger's base, which belongs to the ledger and is set there.
 *
 * A destination's own currency is still recorded — linking an expense to a plan
 * prefills that expense's currency from it — it is simply no longer something
 * anyone is asked to confirm.
 */
export function DestinationSummary({
  currency,
  timeZone,
  tx,
}: {
  currency?: string;
  timeZone?: string;
  tx: (zh: string, en: string) => string;
}) {
  if (!timeZone) return null;
  return (
    <View style={styles.wrap}>
      <ThemedText type="small" themeColor="textSecondary">
        {currency
          ? tx(`时间按 ${timeZone} 显示 · 当地货币 ${currency}`, `Times shown in ${timeZone} · local currency ${currency}`)
          : tx(`时间按 ${timeZone} 显示`, `Times shown in ${timeZone}`)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: Spacing['2xs'] },
});
