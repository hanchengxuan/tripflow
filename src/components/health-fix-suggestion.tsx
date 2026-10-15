import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionButton, InlineNotice } from '@/components/form-controls';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import type { HealthFix } from '@/features/ai/itinerary-health-fix';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useTheme } from '@/hooks/use-theme';
import { formatZonedDateTimeRange } from '@/lib/trip-time';
import { toUserMessage } from '@/lib/user-error';

export function HealthFixSuggestion({ fix, timeZone, onApply }: { fix: HealthFix; timeZone: string; onApply: (fix: HealthFix) => Promise<void> }) {
  const theme = useTheme();
  const { languageTag, locale, tx } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const range = (item: HealthFix['before']) => formatZonedDateTimeRange(item.startsAt, item.endsAt, languageTag, timeZone);

  const apply = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await onApply(fix);
    } catch (caught) {
      setError(toUserMessage(caught, tx('应用建议失败，请稍后重试。', 'Could not apply the suggestion. Try again later.'), locale));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundSubtle }]}>
      <ThemedText type="smallBold">{tx(`建议：推迟“${fix.before.title}”`, `Suggestion: move “${fix.before.title}” later`)}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{range(fix.before)}</ThemedText>
      <ThemedText type="smallBold" style={{ color: theme.accent }}>→ {range(fix.candidate)}</ThemedText>
      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
      <ActionButton tone="primary" busy={busy} onPress={() => void apply()}>{tx('应用建议', 'Apply suggestion')}</ActionButton>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderRadius: Radius.md, padding: Spacing.sm, gap: Spacing.xs, marginTop: Spacing.xs },
});
