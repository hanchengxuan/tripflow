import { useRouter } from 'expo-router';

import { DestinationAtlas } from '@/components/destination-atlas';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useMvp } from '@/features/mvp/mvp-provider';

export default function AtlasScreen() {
  const router = useRouter();
  const { languageTag, tx } = useI18n();
  const { loading, activeTrip, itineraryItems } = useMvp();
  const context = activeTrip
    ? [
        activeTrip.name,
        tx(String(itineraryItems.length) + ' 项安排', String(itineraryItems.length) + (itineraryItems.length === 1 ? ' plan' : ' plans')),
      ]
    : [tx('还没有选择行程', 'No trip selected')];

  return (
    <Screen loading={loading && !activeTrip} title={tx('地图', 'Map')} context={context}>
      {activeTrip ? (
        <DestinationAtlas
          items={itineraryItems}
          languageTag={languageTag}
          tx={tx}
          onViewItem={(item) => router.push({ pathname: '/itinerary', params: { itemId: item.id } })}
        />
      ) : (
        <EmptyState
          symbol={{ ios: 'map', android: 'map', web: 'map' }}
          title={tx('地图等待行程', 'Map is waiting for a trip')}
          body={tx('创建或加入行程后，这里会显示所有目的地。', 'Create or join a trip to see its destinations here.')}
          actionLabel={tx('去行程', 'Go to Trips')}
          onAction={() => router.push('/explore')}
        />
      )}
    </Screen>
  );
}
