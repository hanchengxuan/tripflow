import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { ActionButton, ChoiceChip, InlineNotice } from '@/components/form-controls';
import { ListDivider, ListSurface } from '@/components/list-surface';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { ItineraryItem } from '@/domain/models';
import { useI18n } from '@/features/i18n/i18n-provider';
import { planDelayShift } from '@/features/itinerary/delay-shift';
import { useMvp } from '@/features/mvp/mvp-provider';
import { useTheme } from '@/hooks/use-theme';
import { formatZonedDateTimeRange } from '@/lib/trip-time';
import { toUserMessage } from '@/lib/user-error';

const delayChoices = [30, 60, 120, 180];

export function DelayShiftSheet({ item, visible, onDismiss, onDone }: {
  item: ItineraryItem;
  visible: boolean;
  onDismiss: () => void;
  onDone: (message: string) => void;
}) {
  const theme = useTheme();
  const { languageTag, locale, tx } = useI18n();
  const { activeTrip, itineraryItems, shiftItineraryItems } = useMvp();
  const [minutes, setMinutes] = useState(60);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  if (!activeTrip) return null;

  const plan = planDelayShift(itineraryItems, item.id, minutes, activeTrip);
  const blocked = plan.outsideTrip || plan.invalid;
  const range = (startsAt: string, endsAt: string | undefined, of: ItineraryItem) =>
    formatZonedDateTimeRange(startsAt, endsAt, languageTag, of.destination?.timeZone ?? activeTrip.defaultTimeZone);
  const label = (value: number) => value < 60
    ? tx(`${value} 分钟`, `${value} min`)
    : tx(`${value / 60} 小时`, `${value / 60} hr`);

  const apply = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await shiftItineraryItems(plan.shifts);
      onDone(tx(`已顺延 ${plan.shifts.length} 项安排。`, `Moved ${plan.shifts.length} ${plan.shifts.length === 1 ? 'plan' : 'plans'} later.`));
    } catch (caught) {
      setError(toUserMessage(caught, tx('顺延失败，安排没有改动。请刷新后重试。', 'Nothing was moved. Refresh and try again.'), locale));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet title={tx(`“${item.title}”延误了`, `“${item.title}” is delayed`)} visible={visible} onDismiss={onDismiss} dismissDisabled={busy}>
      <View style={styles.body}>
        <ThemedText type="small" themeColor="textSecondary">{tx('晚了多久？后面的安排只在来不及时才顺延，空档会先被用掉。', 'How late? Later plans only move when they would no longer fit; free time absorbs the delay first.')}</ThemedText>
        <View style={styles.chips}>
          {delayChoices.map((choice) => (
            <ChoiceChip key={choice} role="radio" selected={minutes === choice} onPress={() => { setMinutes(choice); setError(undefined); }}>{label(choice)}</ChoiceChip>
          ))}
        </View>
        <ListSurface>
          {plan.shifts.map(({ item: shifted, startsAt, endsAt }, index) => (
            <View key={shifted.id} style={styles.row}>
              {index > 0 ? <ListDivider /> : null}
              <ThemedText type="smallBold">{shifted.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{range(shifted.startsAt, shifted.endsAt, shifted)}</ThemedText>
              <ThemedText type="smallBold" style={{ color: theme.accent }}>→ {range(startsAt, shifted.endsAt ? endsAt : undefined, shifted)}</ThemedText>
            </View>
          ))}
        </ListSurface>
        {plan.outsideTrip ? <InlineNotice tone="error">{tx('有安排会被推到行程日期之外，请先调整行程日期。', 'A plan would move past the trip dates. Extend the trip first.')}</InlineNotice> : null}
        {plan.invalid ? <InlineNotice tone="error">{tx('酒店入住会晚于退房，请手动调整。', 'A hotel check-in would pass its check-out. Adjust it by hand.')}</InlineNotice> : null}
        {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
        <ActionButton busy={busy} disabled={blocked || plan.shifts.length === 0} onPress={() => void apply()}>
          {tx(`全部顺延（${plan.shifts.length} 项）`, `Move ${plan.shifts.length} ${plan.shifts.length === 1 ? 'plan' : 'plans'} later`)}
        </ActionButton>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: Spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  row: { gap: 2, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
});
