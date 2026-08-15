import { Fragment, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FormField } from '@/components/form-controls';
import { InfoCard } from '@/components/info-card';
import { DaySeparator, TimelineRow } from '@/components/timeline-rail';
import { Screen } from '@/components/screen';
import { SectionHeading } from '@/components/section-heading';
import { ThemedText } from '@/components/themed-text';
import { itineraryKindLabels, itineraryKindLabelsEn } from '@/constants/options';
import type { ThemeColor } from '@/constants/theme';
import type { ItineraryItem, ItineraryKind } from '@/domain/models';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useMvp } from '@/features/mvp/mvp-provider';
import { isoToZonedDateTime } from '@/lib/trip-time';
import { useTheme } from '@/hooks/use-theme';

const kindColorKeys: Record<ItineraryKind, ThemeColor> = {
  transport: 'kindTransport',
  lodging: 'kindLodging',
  food: 'kindFood',
  activity: 'kindActivity',
  task: 'kindTask',
  note: 'kindNote',
};

const kindSoftColorKeys: Record<ItineraryKind, ThemeColor> = {
  transport: 'kindTransportSoft',
  lodging: 'kindLodgingSoft',
  food: 'kindFoodSoft',
  activity: 'kindActivitySoft',
  task: 'kindTaskSoft',
  note: 'kindNoteSoft',
};

function formatDayLabel(date: string, locale: string) {
  return new Date(date + 'T12:00:00').toLocaleDateString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function searchableText(item: ItineraryItem) {
  return [
    item.title,
    item.locationLabel,
    item.destination?.cityName,
    item.destination?.countryName,
    item.destination?.countryCode,
  ].filter(Boolean).join(' ').toLocaleLowerCase();
}

export default function ItineraryScreen() {
  const { languageTag, locale, tx } = useI18n();
  const theme = useTheme();
  const { activeTrip, itineraryItems } = useMvp();
  const [query, setQuery] = useState('');
  const kindLabel = (kind: ItineraryKind) => locale === 'zh-CN' ? itineraryKindLabels[kind] : itineraryKindLabelsEn[kind];
  const itemPlace = (item: ItineraryItem) => {
    if (!item.destination) return item.locationLabel;
    if (!item.locationLabel || item.locationLabel === item.destination.cityName) {
      return [item.destination.cityName, item.destination.countryName].join(' · ');
    }
    return [item.destination.cityName, item.locationLabel].join(' · ');
  };

  const allItems = useMemo(
    () => [...itineraryItems].sort((left, right) => left.startsAt.localeCompare(right.startsAt)),
    [itineraryItems],
  );
  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return allItems;
    return allItems.filter((item) => searchableText(item).includes(normalized));
  }, [allItems, query]);

  const context = activeTrip
    ? [
        activeTrip.name,
        tx(String(itineraryItems.length) + ' 项安排', String(itineraryItems.length) + ' plans'),
      ]
    : [tx('还没有选择行程', 'No trip selected')];

  return (
    <Screen title={tx('安排', 'Plans')} context={context}>
      <SectionHeading
        title={tx('全部安排', 'All plans')}
        detail={tx('按时间查看这趟行程的完整安排，包括已经结束的项目。', 'Scan the complete trip timeline, including plans that have already ended.')}
        trailing={activeTrip ? (
          <ThemedText type="small" themeColor="textSecondary">
            {String(filteredItems.length) + '/' + String(allItems.length)}
          </ThemedText>
        ) : null}
      />
      {activeTrip ? (
        <>
          <FormField
            label={tx('查找安排', 'Find a plan')}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            placeholder={tx('搜索标题、地点或目的地', 'Search titles, places, or destinations')}
          />
          {filteredItems.length > 0 ? (
            <View style={styles.timeline}>
              {filteredItems.map((item, index) => {
                const timeZone = item.destination?.timeZone ?? activeTrip.defaultTimeZone;
                const start = isoToZonedDateTime(item.startsAt, timeZone);
                const end = item.endsAt ? isoToZonedDateTime(item.endsAt, timeZone) : undefined;
                const previous = filteredItems[index - 1];
                const previousTimeZone = previous?.destination?.timeZone ?? activeTrip.defaultTimeZone;
                const previousDate = previous ? isoToZonedDateTime(previous.startsAt, previousTimeZone).date : undefined;
                return (
                  <Fragment key={item.id}>
                    {start.date !== previousDate ? <DaySeparator label={formatDayLabel(start.date, languageTag)} /> : null}
                    <TimelineRow
                      startLabel={start.time}
                      endLabel={end && end.date === start.date ? end.time : undefined}
                      title={item.title}
                      place={itemPlace(item)}
                      kindColor={theme[kindColorKeys[item.kind]]}
                      kindSoftColor={theme[kindSoftColorKeys[item.kind]]}
                      kindLabel={kindLabel(item.kind)}
                      last={index === filteredItems.length - 1}>
                      {end && end.date !== start.date ? (
                        <ThemedText type="small" themeColor="textSecondary">
                          {tx('结束于 ', 'Ends ') + formatDayLabel(end.date, languageTag) + ' ' + end.time}
                        </ThemedText>
                      ) : null}
                    </TimelineRow>
                  </Fragment>
                );
              })}
            </View>
          ) : (
            <InfoCard title={tx('没有匹配的安排', 'No matching plans')}>
              <ThemedText themeColor="textSecondary">
                {query.trim()
                  ? tx('试试搜索城市、地点或安排标题。', 'Try a city, place, or plan title.')
                  : tx('点击“添加安排”开始。', 'Choose Add plan to start.')}
              </ThemedText>
            </InfoCard>
          )}
        </>
      ) : (
        <InfoCard title={tx('还没有行程', 'No trip yet')}>
          <ThemedText themeColor="textSecondary">
            {tx('创建或加入一个行程后，所有安排会集中显示在这里。', 'Create or join a trip to see every plan in one place.')}
          </ThemedText>
        </InfoCard>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  timeline: { gap: 0 },
});
