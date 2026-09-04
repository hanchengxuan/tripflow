import { Fragment, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { ChoiceChip, InlineNotice } from '@/components/form-controls';
import { InfoCard } from '@/components/info-card';
import { ItineraryComposerSheet } from '@/components/itinerary-composer-sheet';
import { ItineraryHealthCard } from '@/components/itinerary-health-card';
import { MoveItineraryCard } from '@/components/move-itinerary-card';
import { NextUpCard } from '@/components/next-up-card';
import { StayCard } from '@/components/stay-card';
import { MapsLink, RouteEstimateChip, routeTravelModeLabel, routeTravelModes, TransitPlan } from '@/components/route-plan';
import { DaySeparator, RouteSegment, TimelineRow } from '@/components/timeline-rail';
import { Screen } from '@/components/screen';
import { SectionHeading } from '@/components/section-heading';
import { ThemedText } from '@/components/themed-text';
import { itineraryKindLabels, itineraryKindLabelsEn } from '@/constants/options';
import type { ThemeColor } from '@/constants/theme';
import type { ItineraryItem, ItineraryKind, RouteTravelMode } from '@/domain/models';
import { destinationLabel } from '@/features/destinations/destination-search';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useMvp } from '@/features/mvp/mvp-provider';
import { tripTimeZone as deriveTripTimeZone } from '@/features/trips/trip-defaults';
import { getRouteEstimate, type RouteEstimate } from '@/features/routes/route-estimate';
import { toUserMessage } from '@/lib/user-error';
import { formatZonedDateTimeRange, isoToZonedDateTime, stayNightsInZone } from '@/lib/trip-time';
import { useTheme } from '@/hooks/use-theme';

function formatTripDates(startsOn: string, endsOn: string, locale: string) {
  const start = new Date(`${startsOn}T12:00:00`);
  const end = new Date(`${endsOn}T12:00:00`);
  return `${start.toLocaleDateString(locale, { month: 'short', day: 'numeric' })} — ${end.toLocaleDateString(locale, { month: 'short', day: 'numeric' })}`;
}

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
  return new Date(`${date}T12:00:00`).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function TodayScreen() {
  const { locale, languageTag, tx } = useI18n();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 520;
  const { activeTrip, trips, members, itineraryItems, error, currentUserId, addItineraryItem, addStayTransfer, saveItineraryItem, saveTrip, setItineraryRouteMode, moveItineraryItem, removeItineraryItem } = useMvp();
  const [success, setSuccess] = useState<string>();
  // Failures from the timeline's own actions — route mode, hotel transfer.
  // They used to be written into the composer's error slot, which only renders
  // inside that sheet, so a failed travel-mode change said nothing at all.
  const [actionError, setActionError] = useState<string>();
  const [busyRouteId, setBusyRouteId] = useState<string>();
  const [busyTravelModeId, setBusyTravelModeId] = useState<string>();
  const [expandedRouteModeId, setExpandedRouteModeId] = useState<string>();
  const [currentTimestamp, setCurrentTimestamp] = useState(0);
  const [editingItemId, setEditingItemId] = useState<string>();
  const [composerOpen, setComposerOpen] = useState(false);
  const [routeEstimates, setRouteEstimates] = useState<Record<string, RouteEstimate>>({});
  const [movingItemId, setMovingItemId] = useState<string>();
  const [moveTargetTripId, setMoveTargetTripId] = useState('');
  const [moveBusy, setMoveBusy] = useState(false);
  const [moveError, setMoveError] = useState<string>();

  const currentMember = members.find(({ userId }) => userId === currentUserId);
  const canEdit = currentMember?.role === 'owner' || currentMember?.role === 'editor';
  const upcomingItems = useMemo(() => itineraryItems.filter((item) => !currentTimestamp || new Date(item.endsAt ?? item.startsAt).getTime() >= currentTimestamp), [currentTimestamp, itineraryItems]);
  const stays = useMemo(() => itineraryItems.filter(({ kind }) => kind === 'lodging'), [itineraryItems]);
  const upcomingStays = useMemo(() => stays.filter((stay) => !currentTimestamp || new Date(stay.endsAt ?? stay.startsAt).getTime() >= currentTimestamp), [currentTimestamp, stays]);
  const visibleStays = useMemo(() => upcomingStays.slice(0, 3), [upcomingStays]);
  const laterItems = useMemo(
    () => upcomingItems.slice(1).filter((item) => item.kind !== 'lodging' || !visibleStays.some((stay) => stay.id === item.id)),
    [upcomingItems, visibleStays],
  );
  const tripRange = activeTrip ? formatTripDates(activeTrip.startsOn, activeTrip.endsOn, languageTag) : undefined;
  // Derived from the itinerary rather than read off the trip: the stored
  // value is only ever a fallback for a trip whose plans name no destination.
  const tripTimeZone = deriveTripTimeZone(activeTrip, itineraryItems);
  const editingItem = itineraryItems.find(({ id }) => id === editingItemId);
  const movingItem = itineraryItems.find(({ id }) => id === movingItemId);
  const moveTripOptions = useMemo(
    () => trips
      .filter(({ id }) => id !== activeTrip?.id)
      .map((trip) => ({
        value: trip.id,
        label: `${trip.name} · ${formatTripDates(trip.startsOn, trip.endsOn, languageTag)}`,
      })),
    [activeTrip?.id, languageTag, trips],
  );

  useEffect(() => {
    if (!activeTrip) return;
    const timeout = setTimeout(() => {
      setCurrentTimestamp(Date.now());
      setEditingItemId(undefined);
      setComposerOpen(false);
      setExpandedRouteModeId(undefined);
      setMovingItemId(undefined);
      setMoveTargetTripId('');
      setMoveError(undefined);
    }, 0);
    return () => clearTimeout(timeout);
  }, [activeTrip]);

  useEffect(() => {
    if (!activeTrip) return;
    const pairs = itineraryItems.slice(1).flatMap((item, index) => {
      const previous = itineraryItems[index];
      return previous.googlePlaceId && item.googlePlaceId
        ? [{ key: item.id, origin: previous.googlePlaceId, destination: item.googlePlaceId, travelMode: item.routeTravelMode, departureTime: previous.endsAt ?? previous.startsAt }]
        : [];
    });
    if (pairs.length === 0) {
      const timeout = setTimeout(() => setRouteEstimates({}), 0);
      return () => clearTimeout(timeout);
    }
    let cancelled = false;
    void Promise.all(pairs.map(async (pair) => ({
      ...pair,
      estimate: await getRouteEstimate(activeTrip.id, pair.origin, pair.destination, pair.travelMode, pair.departureTime).catch(() => null),
    })))
      .then((results) => {
        if (!cancelled) setRouteEstimates(Object.fromEntries(results.flatMap(({ key, estimate }) => estimate ? [[key, estimate]] : [])));
      })
      .catch(() => { if (!cancelled) setRouteEstimates({}); });
    return () => { cancelled = true; };
  }, [activeTrip, itineraryItems]);

  useEffect(() => {
    if (!movingItemId || moveTripOptions.some(({ value }) => value === moveTargetTripId)) return;
    const nextTarget = moveTripOptions[0]?.value ?? '';
    const timeout = setTimeout(() => setMoveTargetTripId(nextTarget), 0);
    return () => clearTimeout(timeout);
  }, [moveTargetTripId, moveTripOptions, movingItemId]);

  function cancelMove() {
    setMovingItemId(undefined);
    setMoveTargetTripId('');
    setMoveError(undefined);
  }

  function beginMove(item: ItineraryItem) {
    cancelEdit();
    setMovingItemId(item.id);
    setMoveTargetTripId(moveTripOptions[0]?.value ?? '');
    setMoveError(undefined);
    setSuccess(undefined);
  }

  async function submitMove() {
    if (!movingItem || !moveTargetTripId) return;
    const targetTrip = trips.find(({ id }) => id === moveTargetTripId);
    if (!targetTrip) return;
    setMoveBusy(true);
    setMoveError(undefined);
    setSuccess(undefined);
    try {
      await moveItineraryItem(movingItem.id, targetTrip.id);
      cancelMove();
      setSuccess(tx(`“${movingItem.title}”已移动到${targetTrip.name}。`, `“${movingItem.title}” moved to ${targetTrip.name}.`));
    } catch (caught) {
      setMoveError(toUserMessage(caught, tx('无法移动这项安排，请稍后重试。', 'Could not move this plan. Please try again.')));
    } finally {
      setMoveBusy(false);
    }
  }

  /** A stay can take a transfer once, and only when the previous plan has a place. */
  function canAddStayTransfer(item: ItineraryItem) {
    return item.kind === 'lodging'
      && Boolean(previousPlaceFor(item)?.locationLabel)
      && Boolean(item.locationLabel)
      && !itineraryItems.some(({ linkedStayId }) => linkedStayId === item.id);
  }

  function beginEdit(item: ItineraryItem) {
    cancelMove();
    setEditingItemId(item.id);
    setComposerOpen(true);
    setSuccess(undefined);
  }

  function cancelEdit() {
    setEditingItemId(undefined);
    setComposerOpen(false);
  }

  function openNewComposer() {
    cancelMove();
    setEditingItemId(undefined);
    setComposerOpen(true);
    setSuccess(undefined);
  }

  function itemTimeZoneFor(item: ItineraryItem) {
    return item.destination?.timeZone ?? tripTimeZone;
  }

  function itemPlace(item: ItineraryItem) {
    if (!item.destination) return item.locationLabel;
    if (!item.locationLabel || item.locationLabel === item.destination.cityName) return destinationLabel(item.destination);
    return `${item.destination.cityName} · ${item.locationLabel}`;
  }

  function previousPlaceFor(stay: (typeof itineraryItems)[number]) {
    return itineraryItems
      .filter((item) => item.id !== stay.id
        && item.linkedStayId !== stay.id
        && item.locationLabel
        && new Date(item.endsAt ?? item.startsAt) <= new Date(stay.startsAt))
      .sort((a, b) => new Date(b.endsAt ?? b.startsAt).getTime() - new Date(a.endsAt ?? a.startsAt).getTime())[0];
  }

  async function addRouteToStay(stay: (typeof itineraryItems)[number]) {
    const previous = previousPlaceFor(stay);
    if (!previous?.locationLabel || !stay.locationLabel) return;
    setBusyRouteId(stay.id);
    setActionError(undefined);
    setSuccess(undefined);
    try {
      await addStayTransfer({
        stayId: stay.id,
        sourceItemId: previous.id,
        title: tx(`从 ${previous.locationLabel} 前往 ${stay.locationLabel}`, `${previous.locationLabel} to ${stay.locationLabel}`),
      });
      setSuccess(tx('前往酒店的交通已加入时间线，可继续补充车次或集合信息。', 'Transfer to the hotel added. You can add train, pickup, or meeting details next.'));
    } catch (caught) {
      setActionError(toUserMessage(caught, tx('无法添加前往酒店的交通，请稍后重试。', 'Could not add the hotel transfer. Please try again.')));
    } finally {
      setBusyRouteId(undefined);
    }
  }

  const kindLabel = (itemKind: ItineraryKind) => locale === 'zh-CN' ? itineraryKindLabels[itemKind] : itineraryKindLabelsEn[itemKind];
  const kindAccent = (itemKind: ItineraryKind) => theme[kindColorKeys[itemKind]];
  const kindSoftAccent = (itemKind: ItineraryKind) => theme[kindSoftColorKeys[itemKind]];

  function formatRouteEstimate(estimate?: RouteEstimate) {
    if (!estimate) return undefined;
    const distance = estimate.distanceMeters >= 1000 ? `${(estimate.distanceMeters / 1000).toFixed(1)} km` : `${estimate.distanceMeters} m`;
    const minutes = Math.max(1, Math.round(estimate.durationSeconds / 60));
    return tx(`${distance} · 约 ${minutes} 分钟`, `${distance} · about ${minutes} min`);
  }

  function formatTransitTime(isoTime?: string, localizedTime?: string, timeZone = tripTimeZone) {
    if (!isoTime) return localizedTime;
    const value = new Date(isoTime);
    if (Number.isNaN(value.getTime())) return localizedTime;
    return new Intl.DateTimeFormat(languageTag, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone,
    }).format(value);
  }

  async function changeRouteMode(item: ItineraryItem, travelMode: RouteTravelMode) {
    setExpandedRouteModeId(undefined);
    if (item.routeTravelMode === travelMode) return;
    setBusyTravelModeId(item.id);
    setActionError(undefined);
    try {
      await setItineraryRouteMode(item.id, travelMode);
    } catch (caught) {
      setActionError(toUserMessage(caught, tx('无法更新出行方式，请稍后重试。', 'Could not update the travel mode. Please try again.')));
    } finally {
      setBusyTravelModeId(undefined);
    }
  }

  function routeContext(item: ItineraryItem) {
    const itemIndex = itineraryItems.findIndex(({ id }) => id === item.id);
    const previous = itemIndex > 0 ? itineraryItems[itemIndex - 1] : undefined;
    if (!item.locationLabel || !previous?.locationLabel) return null;
    const travelMode = item.routeTravelMode === 'TRANSIT' ? 'transit' : item.routeTravelMode === 'WALK' ? 'walking' : item.routeTravelMode === 'BICYCLE' ? 'bicycling' : 'driving';
    return {
      estimate: formatRouteEstimate(routeEstimates[item.id]),
      mapsUrl: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(previous.locationLabel)}${previous.googlePlaceId ? `&origin_place_id=${encodeURIComponent(previous.googlePlaceId)}` : ''}&destination=${encodeURIComponent(item.locationLabel)}${item.googlePlaceId ? `&destination_place_id=${encodeURIComponent(item.googlePlaceId)}` : ''}&travelmode=${travelMode}`,
    };
  }

  function routeModeControls(item: ItineraryItem) {
    if (!canEdit || expandedRouteModeId !== item.id) return null;
    return (
      <View style={styles.routeModeRow}>
        {routeTravelModes.map((mode) => (
          <ChoiceChip
            key={mode}
            role="radio"
            selected={item.routeTravelMode === mode}
            disabled={Boolean(busyTravelModeId)}
            onPress={() => void changeRouteMode(item, mode)}>
            {routeTravelModeLabel(mode, tx)}
          </ChoiceChip>
        ))}
      </View>
    );
  }

  function routeSummary(item: ItineraryItem, estimate?: string) {
    const detail = busyTravelModeId === item.id ? tx('正在重新计算…', 'Recalculating…') : estimate ?? tx('路线详情待生成', 'Route estimate pending');
    const modeLabel = routeTravelModeLabel(item.routeTravelMode, tx);
    return (
      <RouteEstimateChip
        accessibilityLabel={tx(`当前为${modeLabel}，${detail}。点按切换出行方式`, `${modeLabel} selected. ${detail}. Choose travel mode`)}
        expanded={expandedRouteModeId === item.id}
        modeLabel={modeLabel}
        onPress={canEdit ? () => setExpandedRouteModeId((current) => current === item.id ? undefined : item.id) : undefined}
        detail={detail}
      />
    );
  }

  function transitPlan(item: ItineraryItem) {
    const transit = routeEstimates[item.id]?.transit;
    if (item.routeTravelMode !== 'TRANSIT' || busyTravelModeId === item.id || !transit) return null;
    return <TransitPlan transit={transit} compact={compact} tx={tx} formatTime={(isoTime, localizedTime) => formatTransitTime(isoTime, localizedTime, itemTimeZoneFor(item))} />;
  }

  /** Travel between two rail rows: it occupies the gap instead of nesting in a row. */
  function routeSegment(item: ItineraryItem) {
    const context = routeContext(item);
    if (!context) return null;
    return (
      <RouteSegment
        summary={routeSummary(item, context.estimate)}
        trailing={<MapsLink url={context.mapsUrl} label={tx('地图', 'Map')} />}>
        {routeModeControls(item)}
        {transitPlan(item)}
      </RouteSegment>
    );
  }

  const interactionOpen = composerOpen || Boolean(movingItemId);

  return (
    <>
      <Screen
      context={activeTrip
        ? [tripRange ?? '', tx(`${members.length} 人同行`, `${members.length} travellers`), tx(`${upcomingItems.length} 项待办`, `${upcomingItems.length} ahead`)]
        : [tx('还没有进行中的行程', 'No active trip yet')]}
      title={activeTrip?.name ?? tx('今天', 'Today')}
      floatingAction={activeTrip && canEdit ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={interactionOpen ? tx('关闭当前操作', 'Close current action') : tx('添加安排', 'Add plan')}
          accessibilityState={{ expanded: interactionOpen }}
          onPress={() => {
            if (composerOpen) {
              cancelEdit();
              return;
            }
            if (movingItemId) {
              cancelMove();
              return;
            }
            openNewComposer();
          }}
          style={({ pressed }) => [styles.floatingAdd, { backgroundColor: theme.accent, shadowColor: theme.shadow }, pressed && styles.pressed]}>
          <View style={interactionOpen ? styles.closeIcon : styles.plusIcon}>
            <View style={[interactionOpen ? styles.closeDiagonalOne : styles.plusHorizontal, { backgroundColor: theme.textOnAccent }]} />
            <View style={[interactionOpen ? styles.closeDiagonalTwo : styles.plusVertical, { backgroundColor: theme.textOnAccent }]} />
          </View>
        </Pressable>
      ) : null}
    >
      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
      {actionError ? <InlineNotice tone="error">{actionError}</InlineNotice> : null}
      {success ? <InlineNotice>{success}</InlineNotice> : null}

      {!activeTrip ? (
        <InfoCard label={tx('暂无行程', 'No trip yet')} title={tx('创建或加入共享行程', 'Create or join a shared trip')}>
          <ThemedText themeColor="textSecondary">{tx('加入后，所有成员都可以在这里查看下一项已确认的安排。', 'Once joined, everyone can see the next confirmed plan here.')}</ThemedText>
        </InfoCard>
      ) : upcomingItems.length > 0 ? (
        <>
          <NextUpCard
            kindColor={kindAccent(upcomingItems[0].kind)}
            kindLabel={tx(`${kindLabel(upcomingItems[0].kind)} ${itineraryKindLabelsEn[upcomingItems[0].kind].toUpperCase()}`, itineraryKindLabelsEn[upcomingItems[0].kind].toUpperCase())}
            location={upcomingItems[0].locationLabel ?? tx('还没设置地点', 'No place yet')}
            mapLabel={tx('打开地图 Open map', 'Open map')}
            nextLabel={tx('下一步 UP NEXT', 'UP NEXT')}
            onMapPress={upcomingItems[0].locationLabel ? () => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(upcomingItems[0].locationLabel ?? '')}`) : undefined}
            onPress={canEdit ? () => beginEdit(upcomingItems[0]) : undefined}
            timeLabel={formatZonedDateTimeRange(upcomingItems[0].startsAt, upcomingItems[0].endsAt, languageTag, tripTimeZone)}
            timeMetaLabel={tx('时间 WHEN', 'WHEN')}
            title={upcomingItems[0].title}
            travellersMetaLabel={tx('同行 WHO', 'WHO')}
            travellersLabel={tx(`${members.length} 人可见`, `${members.length} travellers can see this`)}
          />

          {visibleStays.length > 0 ? (
            <View style={styles.staySection}>
              <SectionHeading
                title={tx('住宿安排', 'Stays')}
                trailing={<ThemedText type="small" themeColor="textSecondary">{tx(`${visibleStays.length} 段`, `${visibleStays.length}`)}</ThemedText>}
              />
              {visibleStays.map((stay) => {
                const nights = stayNightsInZone(stay.startsAt, stay.endsAt, itemTimeZoneFor(stay));
                return (
                  <View key={stay.id} style={styles.stayRow}>
                    <StayCard
                      dateRange={formatZonedDateTimeRange(stay.startsAt, stay.endsAt, languageTag, itemTimeZoneFor(stay))}
                      location={itemPlace(stay) ?? tx('还没设置地点', 'No place yet')}
                      nights={nights}
                      onPress={canEdit ? () => beginEdit(stay) : undefined}
                      style={styles.stayCard}
                      title={stay.title}
                    />
                  </View>
                );
              })}
              {upcomingStays.length > visibleStays.length ? <ThemedText type="small" themeColor="textSecondary">{tx(`另有 ${upcomingStays.length - visibleStays.length} 段住宿显示在后续时间线中`, `${upcomingStays.length - visibleStays.length} more stays appear later in the timeline`)}</ThemedText> : null}
            </View>
          ) : null}
          {laterItems.length > 0 ? (
            <View style={styles.timelineSection}>
              <SectionHeading
                title={tx('后续安排', 'Later')}
                trailing={<ThemedText type="small" themeColor="textSecondary">{laterItems.length}</ThemedText>}
              />
              {laterItems.map((item, index) => {
                const itemTimeZone = itemTimeZoneFor(item);
                const previousItem = laterItems[index - 1] ?? upcomingItems[0];
                const start = isoToZonedDateTime(item.startsAt, itemTimeZone);
                const end = item.endsAt ? isoToZonedDateTime(item.endsAt, itemTimeZone) : undefined;
                const previousDate = isoToZonedDateTime(previousItem.startsAt, itemTimeZoneFor(previousItem)).date;
                return (
                  <Fragment key={item.id}>
                    {start.date !== previousDate ? <DaySeparator label={formatDayLabel(start.date, languageTag)} /> : null}
                    {routeSegment(item)}
                    <TimelineRow
                      startLabel={start.time}
                      endLabel={end && end.date === start.date ? end.time : undefined}
                      title={item.title}
                      place={itemPlace(item)}
                      kindColor={kindAccent(item.kind)}
                      kindSoftColor={kindSoftAccent(item.kind)}
                      kindLabel={kindLabel(item.kind)}
                      last={index === laterItems.length - 1}
                      onPress={canEdit ? () => beginEdit(item) : undefined}
                    />
                  </Fragment>
                );
              })}
            </View>
          ) : null}
        </>
      ) : (
        <InfoCard label={tx('时间线已就绪', 'Timeline ready')} title={tx('还没有安排', 'Nothing planned yet')}>
          <ThemedText themeColor="textSecondary">{tx('点击“添加安排”开始。', 'Choose Add plan to start.')}</ThemedText>
        </InfoCard>
      )}

      {activeTrip ? <ItineraryHealthCard items={upcomingItems.slice(0, 30)} onEditItem={canEdit ? beginEdit : undefined} /> : null}

      {activeTrip && !canEdit ? (
        <View style={[styles.readOnlyBadge, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="smallBold">{tx('仅查看', 'View only')}</ThemedText>
        </View>
      ) : null}
      </Screen>

      <BottomSheet
        onDismiss={cancelMove}
        title={movingItem ? tx(`移动“${movingItem.title}”`, `Move “${movingItem.title}”`) : tx('移动安排', 'Move plan')}
        visible={Boolean(activeTrip && movingItem)}>
        {movingItem ? (
          <MoveItineraryCard
            busy={moveBusy}
            embedded
            error={moveError}
            item={movingItem}
            onCancel={cancelMove}
            onMove={() => void submitMove()}
            onTargetTripChange={setMoveTargetTripId}
            targetTripId={moveTargetTripId}
            targetTripOptions={moveTripOptions}
          />
        ) : null}
      </BottomSheet>

      {/* One plan editor for the whole product. Today used to keep its own
          copy, so editing the same plan from here and from 安排 gave two
          different panels; the actions that were only ever on Today — open
          map, add the hotel transfer, move to another trip — are now rows in
          the shared one. */}
      {activeTrip && canEdit ? (
        <ItineraryComposerSheet
          activeTrip={activeTrip}
          addingStayTransfer={busyRouteId === editingItem?.id}
          editingItem={editingItem}
          itineraryItems={itineraryItems}
          onAdd={addItineraryItem}
          onAddStayTransfer={editingItem && canAddStayTransfer(editingItem) ? () => void addRouteToStay(editingItem) : undefined}
          onDelete={removeItineraryItem}
          onDismiss={cancelEdit}
          onExtendTrip={(range) => saveTrip({
            name: activeTrip.name,
            startsOn: range.startsOn,
            endsOn: range.endsOn,
            homeCurrency: activeTrip.homeCurrency,
            defaultTimeZone: activeTrip.defaultTimeZone,
          })}
          onMove={editingItem && trips.length > 1 ? () => beginMove(editingItem) : undefined}
          onOpenMap={editingItem?.locationLabel
            ? () => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(editingItem.locationLabel ?? '')}`)
            : undefined}
          onSave={saveItineraryItem}
          onSuccess={setSuccess}
          visible={composerOpen}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  floatingAdd: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  plusIcon: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  closeIcon: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  plusHorizontal: { position: 'absolute', width: 18, height: 2, borderRadius: 1 },
  plusVertical: { position: 'absolute', width: 2, height: 18, borderRadius: 1 },
  closeDiagonalOne: { position: 'absolute', width: 18, height: 2, borderRadius: 1, transform: [{ rotate: '45deg' }] },
  closeDiagonalTwo: { position: 'absolute', width: 18, height: 2, borderRadius: 1, transform: [{ rotate: '-45deg' }] },
  timelineSection: { paddingTop: 8 },
  routeModeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  staySection: { gap: 10, paddingVertical: 8 },
  stayRow: { flexDirection: 'row', alignItems: 'stretch', gap: 14 },
  stayCard: { flex: 1 },
  readOnlyBadge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  pressed: { opacity: 0.68 },
});
