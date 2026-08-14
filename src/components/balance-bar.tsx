import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { balanceBarWidths } from '@/lib/balance-bar';

/**
 * Bipolar money summary for one currency.
 *
 * Left of the zero tick is what you owe, right is what is owed to you. Each
 * side is drawn relative to the larger of the two, so the halves stay
 * comparable and the net position is readable at a glance — which four
 * equal-weight metric tiles never conveyed.
 *
 * Colour states direction, never severity, and never carries meaning alone:
 * both sides are labelled.
 */
export function BalanceBar({
  outLabel,
  outAmount,
  outValue,
  inLabel,
  inAmount,
  inValue,
  footnote,
}: {
  outLabel: string;
  outAmount: string;
  outValue: number;
  inLabel: string;
  inAmount: string;
  inValue: number;
  footnote: string;
}) {
  const theme = useTheme();
  const { outPercent, inPercent } = balanceBarWidths(outValue, inValue);

  return (
    <View style={styles.wrap}>
      <View style={styles.legend}>
        <View style={styles.side}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.caption}>{outLabel}</ThemedText>
          <ThemedText type="smallBold" style={[styles.amount, { color: theme.moneyOut }]}>{outAmount}</ThemedText>
        </View>
        <View style={[styles.side, styles.sideEnd]}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.caption}>{inLabel}</ThemedText>
          <ThemedText type="smallBold" style={[styles.amount, { color: theme.moneyIn }]}>{inAmount}</ThemedText>
        </View>
      </View>

      <View style={[styles.track, { backgroundColor: theme.backgroundSubtle }]}>
        {outValue > 0 ? (
          <View style={[styles.fill, styles.fillOut, { width: `${outPercent}%`, backgroundColor: theme.moneyOut }]} />
        ) : null}
        {inValue > 0 ? (
          <View style={[styles.fill, styles.fillIn, { width: `${inPercent}%`, backgroundColor: theme.moneyIn }]} />
        ) : null}
        <View style={[styles.zero, { backgroundColor: theme.text }]} />
      </View>

      <ThemedText type="small" themeColor="textSecondary">{footnote}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, paddingVertical: 4 },
  legend: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
  side: { flex: 1, minWidth: 0, gap: 1 },
  sideEnd: { alignItems: 'flex-end' },
  caption: { fontSize: 12, lineHeight: 16 },
  amount: { fontSize: 19, lineHeight: 25, fontVariant: ['tabular-nums'] },
  track: { height: 12, borderRadius: 999, justifyContent: 'center' },
  fill: { position: 'absolute', top: 0, height: 12, borderRadius: 999 },
  fillOut: { right: '50%' },
  fillIn: { left: '50%' },
  zero: { position: 'absolute', left: '50%', marginLeft: -1, top: -4, width: 2, height: 20, borderRadius: 1 },
});
