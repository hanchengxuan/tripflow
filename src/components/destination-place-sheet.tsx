import { StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { Chevron } from '@/components/chevron';
import { ListDivider, ListRow, ListSurface } from '@/components/list-surface';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import type { ItineraryItem } from '@/domain/models';
import type { DestinationStatus } from '@/lib/destination-status';
import { formatZonedDateTimeRange } from '@/lib/trip-time';
import { useTheme } from '@/hooks/use-theme';

const SHOWN_PLANS = 4;

/**
 * The full place layout, opened from the compact card on the map.
 *
 * The map keeps the frame and this holds the detail, which is the split Apple
 * Maps and Google's place card both make. Every row here has exactly one
 * affordance: pressing it opens that plan. The plans past `SHOWN_PLANS` used
 * to be stated as a sentence with no way to reach them; they are now the last
 * row, which goes to the itinerary filtered to this place.
 */
export function DestinationPlaceSheet({
  cityName,
  countryName,
  currency,
  items,
  languageTag,
  onDismiss,
  onViewAll,
  onViewItem,
  status,
  statusColor,
  statusLabel,
  timeZone,
  tx,
  visible,
}: {
  cityName: string;
  countryName: string;
  currency?: string;
  items: ItineraryItem[];
  languageTag: string;
  onDismiss: () => void;
  onViewAll?: () => void;
  onViewItem?: (item: ItineraryItem) => void;
  status: DestinationStatus;
  statusColor: string;
  statusLabel: string;
  timeZone: string;
  tx: (zh: string, en: string) => string;
  visible: boolean;
}) {
  const theme = useTheme();
  const shown = items.slice(0, SHOWN_PLANS);
  const hidden = items.length - shown.length;

  return (
    <BottomSheet onDismiss={onDismiss} title={cityName} visible={visible}>
      <View style={styles.head}>
        <View style={[styles.status, { backgroundColor: theme.backgroundSubtle }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <ThemedText type="smallBold" themeColor={status === 'current' ? 'text' : 'textSecondary'}>{statusLabel}</ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={styles.meta}>
          {[countryName, timeZone, currency, tx(`${items.length} 项安排`, `${items.length} plans`)]
            .filter(Boolean)
            .join(' · ')}
        </ThemedText>
      </View>

      <ListSurface>
        {shown.map((item, index) => (
          <View key={item.id}>
            {index > 0 ? <ListDivider /> : null}
            <ListRow
              title={item.title}
              subtitle={formatZonedDateTimeRange(item.startsAt, item.endsAt, languageTag, item.destination?.timeZone ?? timeZone)}
              onPress={onViewItem ? () => onViewItem(item) : undefined}
              trailing={onViewItem ? <Chevron color={theme.textMuted} /> : undefined}
            />
          </View>
        ))}
        {onViewAll ? (
          <View>
            {shown.length > 0 ? <ListDivider /> : null}
            <ListRow
              title={hidden > 0
                ? tx(`在行程里看全部 ${items.length} 项`, `See all ${items.length} in the itinerary`)
                : tx('在行程里打开这个地点', 'Open this place in the itinerary')}
              onPress={onViewAll}
              trailing={<Chevron color={theme.textMuted} />}
            />
          </View>
        ) : null}
      </ListSurface>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  head: { gap: Spacing['2xs'] },
  status: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  meta: { flexWrap: 'wrap' },
});
