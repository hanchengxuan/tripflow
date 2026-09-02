import { useLocalSearchParams } from 'expo-router';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ItineraryComposerSheet } from '@/components/itinerary-composer-sheet';
import { PlanFilterBar } from '@/components/plan-filter-bar';
import { SegmentSheet } from '@/components/segment-sheet';
import { SplitSegmentSheet } from '@/components/split-segment-sheet';
import { InlineNotice } from '@/components/form-controls';
import { InfoCard } from '@/components/info-card';
import { DaySeparator, TimelineRow } from '@/components/timeline-rail';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { itineraryKindLabels, itineraryKindLabelsEn } from '@/constants/options';
import type { ThemeColor } from '@/constants/theme';
import type { ItineraryItem, ItineraryKind } from '@/domain/models';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useMvp } from '@/features/mvp/mvp-provider';
import { toUserMessage } from '@/lib/user-error';
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
  const params = useLocalSearchParams<{ itemId?: string | string[] }>();
  const { languageTag, locale, tx } = useI18n();
  const theme = useTheme();
  const {
    activeTrip,
    addItineraryItem,
    dissolveTripSegment,
    error,
    currentUserId,
    itineraryItems,
    members,
    removeItineraryItem,
    saveItineraryItem,
    saveTrip,
    segmentMembers,
    segments,
    splitTripSegment,
  } = useMvp();
  const [query, setQuery] = useState('');
  const [segmentFilterId, setSegmentFilterId] = useState<string>();
  const [branchesOpen, setBranchesOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [splitFromItemId, setSplitFromItemId] = useState<string>();
  const [splitError, setSplitError] = useState<string>();
  const splitFromItem = itineraryItems.find(({ id }) => id === splitFromItemId);
  const segmentNameById = new Map(segments.map((segment) => [segment.id, segment.name]));
  const [editingItemId, setEditingItemId] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const handledItemParam = useRef<string | undefined>(undefined);
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
    return allItems.filter((item) => {
      if (segmentFilterId && item.segmentId !== segmentFilterId) return false;
      return !normalized || searchableText(item).includes(normalized);
    });
  }, [allItems, query, segmentFilterId]);
  const branchCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const { segmentId } of allItems) {
      if (segmentId) counts.set(segmentId, (counts.get(segmentId) ?? 0) + 1);
    }
    return counts;
  }, [allItems]);
  const filtered = Boolean(segmentFilterId) || Boolean(query.trim());

  const currentMember = members.find(({ userId }) => userId === currentUserId);
  const canEdit = currentMember?.role === 'owner' || currentMember?.role === 'editor';
  const editingItem = itineraryItems.find(({ id }) => id === editingItemId);

  const activeTripId = activeTrip?.id;
  const itemIdParam = Array.isArray(params.itemId) ? params.itemId[0] : params.itemId;

  useEffect(() => {
    if (!activeTripId || !currentMember || !itemIdParam || handledItemParam.current === itemIdParam) return;
    const item = itineraryItems.find(({ id }) => id === itemIdParam);
    if (!item) return;
    handledItemParam.current = itemIdParam;
    const timeout = setTimeout(() => {
      if (canEdit) {
        setSuccess(undefined);
        setEditingItemId(item.id);
        setComposerOpen(true);
      } else {
        setQuery(item.title);
      }
    }, 0);
    return () => clearTimeout(timeout);
  }, [activeTripId, canEdit, currentMember, itemIdParam, itineraryItems]);

  function openNewComposer() {
    setSuccess(undefined);
    setEditingItemId(undefined);
    setComposerOpen(true);
  }

  function openEditComposer(item: ItineraryItem) {
    setSuccess(undefined);
    setEditingItemId(item.id);
    setComposerOpen(true);
  }

  function closeComposer() {
    setComposerOpen(false);
    setEditingItemId(undefined);
  }

  const context = activeTrip
    ? [
        activeTrip.name,
        tx(String(itineraryItems.length) + ' 项安排', String(itineraryItems.length) + ' plans'),
      ]
    : [tx('还没有选择行程', 'No trip selected')];

  return (
    <>
      <Screen
        title={tx('安排', 'Plans')}
        context={context}
        floatingAction={activeTrip && canEdit ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={composerOpen ? tx('关闭编辑面板', 'Close editor') : tx('添加安排', 'Add plan')}
            accessibilityState={{ expanded: composerOpen }}
            onPress={composerOpen ? closeComposer : openNewComposer}
            style={({ pressed }) => [styles.floatingAdd, { backgroundColor: theme.accent, shadowColor: theme.shadow }, pressed && styles.pressed]}>
            <View style={composerOpen ? styles.closeIcon : styles.plusIcon}>
              <View style={[composerOpen ? styles.closeDiagonalOne : styles.plusHorizontal, { backgroundColor: theme.textOnAccent }]} />
              <View style={[composerOpen ? styles.closeDiagonalTwo : styles.plusVertical, { backgroundColor: theme.textOnAccent }]} />
            </View>
          </Pressable>
        ) : null}
      >
        {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
        {splitError ? <InlineNotice tone="error">{splitError}</InlineNotice> : null}
        {success ? <InlineNotice>{success}</InlineNotice> : null}
        {activeTrip ? (
          <>
            <PlanFilterBar
              branchCounts={branchCounts}
              onManageBranches={segments.length > 0 ? () => setBranchesOpen(true) : undefined}
              onQueryChange={setQuery}
              onSelectSegment={setSegmentFilterId}
              query={query}
              segments={segments}
              selectedSegmentId={segmentFilterId}
            />
            {filtered ? (
              <ThemedText type="small" themeColor="textSecondary">
                {tx(
                  `显示 ${String(filteredItems.length)} / ${String(allItems.length)} 项安排`,
                  `Showing ${String(filteredItems.length)} of ${String(allItems.length)} plans`,
                )}
              </ThemedText>
            ) : null}
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
                        branch={segmentNameById.get(item.segmentId ?? '')
                          ? tx('分支 ', 'Branch ') + segmentNameById.get(item.segmentId ?? '')
                          : undefined}
                        kindColor={theme[kindColorKeys[item.kind]]}
                        kindSoftColor={theme[kindSoftColorKeys[item.kind]]}
                        kindLabel={kindLabel(item.kind)}
                        last={index === filteredItems.length - 1}
                        onPress={canEdit ? () => openEditComposer(item) : undefined}
                      >
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
                  {segmentFilterId
                    ? tx('这个分支下还没有安排。切回“全部”查看整个行程。', 'This branch has no plans yet. Switch back to All to see the whole trip.')
                    : query.trim()
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
      {activeTrip ? (
        <SegmentSheet
          canEdit={canEdit}
          items={itineraryItems}
          members={members}
          onDismiss={() => setBranchesOpen(false)}
          onDissolve={(segmentId) => {
            setSplitError(undefined);
            if (segmentId === segmentFilterId) setSegmentFilterId(undefined);
            void dissolveTripSegment(segmentId)
              .then(() => setSuccess(tx('分支已解散，安排已回到整个行程。', 'Branch dissolved; its plans are back on the whole trip.')))
              .catch((caught) => setSplitError(toUserMessage(caught, tx('无法解散这个分支，请稍后重试。', 'Could not dissolve this branch. Please try again.'))));
          }}
          segmentMembers={segmentMembers}
          segments={segments}
          timeZone={activeTrip.defaultTimeZone}
          visible={branchesOpen && segments.length > 0}
        />
      ) : null}
      {activeTrip ? (
        <SplitSegmentSheet
          key={splitFromItemId}
          fromItem={splitFromItem}
          members={members}
          onDismiss={() => setSplitFromItemId(undefined)}
          onSplit={splitTripSegment}
          timeZone={activeTrip.defaultTimeZone}
          tripEndsOn={activeTrip.endsOn}
          visible={Boolean(canEdit && splitFromItem)}
        />
      ) : null}
      {activeTrip ? (
        <ItineraryComposerSheet
          activeTrip={activeTrip}
          editingItem={editingItem}
          itineraryItems={itineraryItems}
          onAdd={addItineraryItem}
          onDelete={removeItineraryItem}
          onDismiss={closeComposer}
          onExtendTrip={(range) => saveTrip({
            name: activeTrip.name,
            startsOn: range.startsOn,
            endsOn: range.endsOn,
            homeCurrency: activeTrip.homeCurrency,
            defaultTimeZone: activeTrip.defaultTimeZone,
          })}
          onSave={saveItineraryItem}
          onSuccess={setSuccess}
          onSplitFromHere={canEdit && editingItem && !editingItem.segmentId ? () => {
            const from = editingItem.id;
            closeComposer();
            setSplitFromItemId(from);
          } : undefined}
          visible={Boolean(canEdit && composerOpen)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  timeline: { gap: 0 },
  floatingAdd: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  plusIcon: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  closeIcon: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  plusHorizontal: { position: 'absolute', width: 18, height: 2, borderRadius: 1 },
  plusVertical: { position: 'absolute', width: 2, height: 18, borderRadius: 1 },
  closeDiagonalOne: { position: 'absolute', width: 18, height: 2, borderRadius: 1, transform: [{ rotate: '45deg' }] },
  closeDiagonalTwo: { position: 'absolute', width: 18, height: 2, borderRadius: 1, transform: [{ rotate: '-45deg' }] },
  pressed: { opacity: 0.68 },
});
