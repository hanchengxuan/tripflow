/**
 * Half-width percentages for each side of a balance bar's zero tick.
 *
 * Each side is scaled against the larger of the two so the halves stay
 * comparable and neither can exceed half the track. Both zero yields two empty
 * halves rather than a divide-by-zero. Amounts are integer minor units.
 */
export function balanceBarWidths(outValue: number, inValue: number) {
  const owedOut = Math.max(outValue, 0);
  const owedIn = Math.max(inValue, 0);
  const largest = Math.max(owedOut, owedIn);
  if (largest === 0) return { outPercent: 0, inPercent: 0 };
  return { outPercent: (owedOut / largest) * 50, inPercent: (owedIn / largest) * 50 };
}
