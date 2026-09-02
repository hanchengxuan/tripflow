import { useRouter } from 'expo-router';

import { DestinationAtlas } from '@/components/destination-atlas';
import { InfoCard } from '@/components/info-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useMvp } from '@/features/mvp/mvp-provider';

export default function AtlasScreen() {
  const router = useRouter();
  const { languageTag, tx } = useI18n();
  const { activeTrip, itineraryItems } = useMvp();
  const placeCount = new Set(
    itineraryItems
      .filter(({ destination }) => destination)
      .map(({ destination }) => `${destination!.countryCode}:${destination!.cityName}`),
  ).size;
  // Title plus one context row, and the counts live in it — the section
  // heading that repeated the title and explained the map is gone.
  const context = activeTrip
    ? [
        activeTrip.name,
        tx(`${placeCount} 个地点`, `${placeCount} places`),
        tx(`${itineraryItems.length} 项安排`, `${itineraryItems.length} plans`),
      ]
    : [tx('还没有选择行程', 'No trip selected')];

  return (
    <Screen fill={Boolean(activeTrip)} title={tx('地图', 'Map')} context={context}>
      {activeTrip ? (
        <DestinationAtlas
          items={itineraryItems}
          languageTag={languageTag}
          tx={tx}
          onViewItem={(item) => router.push({ pathname: '/itinerary', params: { itemId: item.id } })}
          onViewPlace={({ cityName }) => router.push({ pathname: '/itinerary', params: { place: cityName } })}
        />
      ) : (
        <InfoCard title={tx('地图等待行程', 'Map is waiting for a trip')}>
          <ThemedText themeColor="textSecondary">
            {tx('创建或加入一个行程后，这里会显示所有已设置目的地。', 'Create or join a trip to see its saved destinations here.')}
          </ThemedText>
        </InfoCard>
      )}
    </Screen>
  );
}
