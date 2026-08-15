import { DestinationAtlas } from '@/components/destination-atlas';
import { InfoCard } from '@/components/info-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useMvp } from '@/features/mvp/mvp-provider';

export default function AtlasScreen() {
  const { languageTag, tx } = useI18n();
  const { activeTrip, itineraryItems } = useMvp();
  const context = activeTrip
    ? [
        activeTrip.name,
        tx(String(itineraryItems.length) + ' 项安排', String(itineraryItems.length) + ' plans'),
      ]
    : [tx('还没有选择行程', 'No trip selected')];

  return (
    <Screen title={tx('地图', 'Map')} context={context}>
      {activeTrip ? (
        <DestinationAtlas items={itineraryItems} languageTag={languageTag} tx={tx} />
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
