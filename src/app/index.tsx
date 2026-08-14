import { Fragment, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { DateTimeField } from '@/components/date-time-field';
import { ActionButton, ChoiceChip, FormField, InlineNotice } from '@/components/form-controls';
import { Chevron } from '@/components/chevron';
import { InfoCard } from '@/components/info-card';
import { ItineraryHealthCard } from '@/components/itinerary-health-card';
import { ItineraryEditAssistant } from '@/components/itinerary-edit-assistant';
import { LocationField } from '@/components/location-field';
import { MoveItineraryCard } from '@/components/move-itinerary-card';
import { SelectionField } from '@/components/selection-field';
import { StayCard } from '@/components/stay-card';
import { MapsLink, RouteEstimateChip, routeTravelModeLabel, routeTravelModes, TransitPlan } from '@/components/route-plan';
import { DaySeparator, RouteSegment, TimelineRow } from '@/components/timeline-rail';
import { Screen } from '@/components/screen';
import { SectionHeading } from '@/components/section-heading';
import { ThemedText } from '@/components/themed-text';
import { itineraryKindLabels, itineraryKindLabelsEn, itineraryKinds } from '@/constants/options';
import type { ThemeColor } from '@/constants/theme';
import type { ItineraryItem, ItineraryKind, RouteTravelMode } from '@/domain/models';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useMvp } from '@/features/mvp/mvp-provider';
import { getRouteEstimate, type RouteEstimate } from '@/features/routes/route-estimate';
import { toUserMessage } from '@/lib/user-error';
import { formatZonedDateTimeRange, isoToZonedDateTime, stayNightsInZone, zonedDateTimeToIso } from '@/lib/trip-time';
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
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [googlePlaceId, setGooglePlaceId] = useState('');
  const [date, setDate] = useState(activeTrip?.startsOn ?? new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(activeTrip?.startsOn ?? new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:30');
  const [kind, setKind] = useState<ItineraryKind>('activity');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [busyRouteId, setBusyRouteId] = useState<string>();
  const [busyTravelModeId, setBusyTravelModeId] = useState<string>();
  const [expandedRouteModeId, setExpandedRouteModeId] = useState<string>();
  const [currentTimestamp, setCurrentTimestamp] = useState(0);
  const [editingItemId, setEditingItemId] = useState<string>();
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerOffset, setComposerOffset] = useState<number>();
  const [pendingTripRange, setPendingTripRange] = useState<{ startsOn: string; endsOn: string }>();
  const [confirmDeleteItem, setConfirmDeleteItem] = useState(false);
  const [routeEstimates, setRouteEstimates] = useState<Record<string, RouteEstimate>>({});
  const [movingItemId, setMovingItemId] = useState<string>();
  const [moveTargetTripId, setMoveTargetTripId] = useState('');
  const [moveOffset, setMoveOffset] = useState<number>();
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
  const tripTimeZone = activeTrip?.defaultTimeZone ?? 'UTC';
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
      setDate(activeTrip.startsOn);
      setEndDate(activeTrip.startsOn);
      setCurrentTimestamp(Date.now());
      setEditingItemId(undefined);
      setComposerOpen(false);
      setComposerOffset(undefined);
      setPendingTripRange(undefined);
      setConfirmDeleteItem(false);
      setExpandedRouteModeId(undefined);
      setMovingItemId(undefined);
      setMoveTargetTripId('');
      setMoveOffset(undefined);
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

  async function submitItem(acceptTripRangeChange = false) {
    setBusy(true);
    setFormError(undefined);
    setSuccess(undefined);
    try {
      if (kind === 'lodging' && !location.trim()) throw new Error(tx('请先选择酒店或住宿地点。', 'Choose the hotel or stay location first.'));
      const startsAt = zonedDateTimeToIso(date, startTime, tripTimeZone);
      const endsAt = editingItem?.linkedStayId && editingItem.endsAt
        ? editingItem.endsAt
        : zonedDateTimeToIso(kind === 'lodging' ? endDate : date, endTime, tripTimeZone);
      if (new Date(endsAt) <= new Date(startsAt)) throw new Error(tx('结束时间需要晚于开始时间。', 'End time must be later than start time.'));
      const nextTripRange = activeTrip ? {
        startsOn: date < activeTrip.startsOn ? date : activeTrip.startsOn,
        endsOn: endDate > activeTrip.endsOn ? endDate : activeTrip.endsOn,
      } : undefined;
      const tripRangeChanged = Boolean(nextTripRange && activeTrip && (nextTripRange.startsOn !== activeTrip.startsOn || nextTripRange.endsOn !== activeTrip.endsOn));
      if (!editingItem && tripRangeChanged && !acceptTripRangeChange) {
        setPendingTripRange(nextTripRange);
        return;
      }
      if (!editingItem && tripRangeChanged && nextTripRange && activeTrip) {
        await saveTrip({
          name: activeTrip.name,
          startsOn: nextTripRange.startsOn,
          endsOn: nextTripRange.endsOn,
          homeCurrency: activeTrip.homeCurrency,
          defaultTimeZone: activeTrip.defaultTimeZone,
        });
      }
      if (editingItem) {
        await saveItineraryItem({ itemId: editingItem.id, title, locationLabel: editingItem.linkedStayId ? editingItem.locationLabel : location, googlePlaceId: editingItem.linkedStayId ? editingItem.googlePlaceId : googlePlaceId, startsAt, endsAt });
      } else {
        await addItineraryItem({ title, locationLabel: location, googlePlaceId, kind, startsAt, endsAt });
      }
      setTitle('');
      setLocation('');
      setGooglePlaceId('');
      setEditingItemId(undefined);
      setComposerOpen(false);
      setComposerOffset(undefined);
      setPendingTripRange(undefined);
      setConfirmDeleteItem(false);
      setSuccess(tripRangeChanged
        ? tx('行程日期已扩展，安排已加入时间线。', 'Trip dates were extended and the plan was added to the timeline.')
        : editingItem
        ? (kind === 'lodging' ? tx('住宿已更新；旧的酒店交通已移除，请按需要重新添加。', 'Stay updated. Its old hotel transfer was removed so you can add a fresh route.') : tx('安排已更新。', 'Plan updated.'))
        : (kind === 'lodging' ? tx('住宿已按入住区间加入，不需要每天重复添加。', 'Stay added for the full date range. No daily duplicates needed.') : tx('安排已加入共享时间线。', 'Plan added to the shared timeline.')));
    } catch (caught) {
      setFormError(toUserMessage(caught, tx('无法添加行程安排，请稍后重试。', 'Could not add this plan. Please try again.')));
    } finally {
      setBusy(false);
    }
  }

  function cancelMove() {
    setMovingItemId(undefined);
    setMoveTargetTripId('');
    setMoveOffset(undefined);
    setMoveError(undefined);
  }

  function beginMove(item: ItineraryItem) {
    cancelEdit();
    setMovingItemId(item.id);
    setMoveTargetTripId(moveTripOptions[0]?.value ?? '');
    setMoveOffset(undefined);
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

  function beginEdit(item: ItineraryItem, deleteFirst = false) {
    cancelMove();
    const start = isoToZonedDateTime(item.startsAt, tripTimeZone);
    const end = isoToZonedDateTime(item.endsAt ?? item.startsAt, tripTimeZone);
    setEditingItemId(item.id);
    setComposerOffset(undefined);
    setComposerOpen(true);
    setConfirmDeleteItem(deleteFirst);
    setTitle(item.title);
    setLocation(item.locationLabel ?? '');
    setGooglePlaceId(item.googlePlaceId ?? '');
    setKind(item.kind);
    setDate(start.date);
    setStartTime(start.time);
    setEndDate(end.date);
    setEndTime(end.time);
    setFormError(undefined);
    setSuccess(undefined);
  }

  function cancelEdit() {
    setEditingItemId(undefined);
    setComposerOpen(false);
    setComposerOffset(undefined);
    setPendingTripRange(undefined);
    setConfirmDeleteItem(false);
    setTitle('');
    setLocation('');
    setGooglePlaceId('');
    setKind('activity');
  }

  function openNewComposer() {
    cancelMove();
    setEditingItemId(undefined);
    setComposerOffset(undefined);
    setPendingTripRange(undefined);
    setConfirmDeleteItem(false);
    setTitle('');
    setLocation('');
    setGooglePlaceId('');
    setDate(activeTrip?.startsOn ?? new Date().toISOString().slice(0, 10));
    setEndDate(activeTrip?.startsOn ?? new Date().toISOString().slice(0, 10));
    setStartTime('09:00');
    setEndTime('10:30');
    setKind('activity');
    setFormError(undefined);
    setSuccess(undefined);
    setComposerOpen(true);
  }

  function updatePlanDate(value: string) {
    setDate(value);
    if (endDate < value) setEndDate(value);
    setPendingTripRange(undefined);
  }

  function updatePlanEndDate(value: string) {
    setEndDate(value);
    setPendingTripRange(undefined);
  }

  async function deleteSelectedItem() {
    if (!editingItem) return;
    setBusy(true);
    setFormError(undefined);
    try {
      await removeItineraryItem(editingItem.id);
      cancelEdit();
      setSuccess(editingItem.kind === 'lodging'
        ? tx('住宿及其关联的酒店交通已删除。', 'Stay and its linked hotel transfer were deleted.')
        : tx('安排已删除。', 'Plan deleted.'));
    } catch (caught) {
      setFormError(toUserMessage(caught, tx('无法删除这项安排，请稍后重试。', 'Could not delete this plan. Please try again.')));
    } finally {
      setBusy(false);
    }
  }

  function chooseKind(nextKind: ItineraryKind) {
    setKind(nextKind);
    if (nextKind !== 'lodging') return;
    setStartTime('15:00');
    setEndTime('11:00');
    const nextDay = new Date(`${date}T12:00:00`);
    nextDay.setDate(nextDay.getDate() + 1);
    setEndDate(nextDay.toISOString().slice(0, 10));
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
    setFormError(undefined);
    setSuccess(undefined);
    try {
      await addStayTransfer({
        stayId: stay.id,
        sourceItemId: previous.id,
        title: tx(`从 ${previous.locationLabel} 前往 ${stay.locationLabel}`, `${previous.locationLabel} to ${stay.locationLabel}`),
      });
      setSuccess(tx('前往酒店的交通已加入时间线，可继续补充车次或集合信息。', 'Transfer to the hotel added. You can add train, pickup, or meeting details next.'));
    } catch (caught) {
      setFormError(toUserMessage(caught, tx('无法添加前往酒店的交通，请稍后重试。', 'Could not add the hotel transfer. Please try again.')));
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

  function formatTransitTime(isoTime?: string, localizedTime?: string) {
    if (!isoTime) return localizedTime;
    const value = new Date(isoTime);
    if (Number.isNaN(value.getTime())) return localizedTime;
    return new Intl.DateTimeFormat(languageTag, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tripTimeZone,
    }).format(value);
  }

  async function changeRouteMode(item: ItineraryItem, travelMode: RouteTravelMode) {
    setExpandedRouteModeId(undefined);
    if (item.routeTravelMode === travelMode) return;
    setBusyTravelModeId(item.id);
    setFormError(undefined);
    try {
      await setItineraryRouteMode(item.id, travelMode);
    } catch (caught) {
      setFormError(toUserMessage(caught, tx('无法更新出行方式，请稍后重试。', 'Could not update the travel mode. Please try again.')));
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
    return <TransitPlan transit={transit} compact={compact} tx={tx} formatTime={formatTransitTime} />;
  }

  /** Route block shown inside the Up-next card, where there is no rail to sit in. */
  function routeDetails(item: ItineraryItem) {
    const context = routeContext(item);
    if (!context) return null;
    return (
      <View style={styles.routeDetails}>
        {routeSummary(item, context.estimate)}
        {routeModeControls(item)}
        {transitPlan(item)}
        <MapsLink url={context.mapsUrl} label={tx('在 Google 地图中规划路线', 'Plan route in Google Maps')} />
      </View>
    );
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

  function itemActions(item: ItineraryItem) {
    if (!canEdit) return null;
    return (
      <View style={styles.itemActions}>
        <Pressable accessibilityRole="button" onPress={() => beginEdit(item)} style={({ pressed }) => [styles.itemTextAction, pressed && styles.pressed]}><ThemedText type="smallBold" style={{ color: theme.link }}>{tx('编辑', 'Edit')}</ThemedText></Pressable>
        {trips.length > 1 ? <Pressable accessibilityRole="button" onPress={() => beginMove(item)} style={({ pressed }) => [styles.itemTextAction, pressed && styles.pressed]}><ThemedText type="smallBold" style={{ color: theme.link }}>{tx('移动', 'Move')}</ThemedText></Pressable> : null}
        <Pressable accessibilityRole="button" onPress={() => beginEdit(item, true)} style={({ pressed }) => [styles.itemTextAction, pressed && styles.pressed]}><ThemedText type="smallBold" style={{ color: theme.danger }}>{tx('删除', 'Delete')}</ThemedText></Pressable>
      </View>
    );
  }

  const interactionOpen = composerOpen || Boolean(movingItemId);

  return (
    <Screen
      context={activeTrip
        ? [tripRange ?? '', tx(`${members.length} 人同行`, `${members.length} travellers`), tx(`${activeTrip.homeCurrency} 本位币`, `Home currency ${activeTrip.homeCurrency}`)]
        : [tx('还没有进行中的行程', 'No active trip yet')]}
      scrollToKey={movingItemId ? 'move-plan' : composerOpen ? (editingItemId ?? 'new-plan') : undefined}
      scrollToOffset={movingItemId ? moveOffset : composerOffset}
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
      {success ? <InlineNotice>{success}</InlineNotice> : null}

      {activeTrip && movingItem ? (
        <View onLayout={({ nativeEvent }) => setMoveOffset(nativeEvent.layout.y)}>
          <MoveItineraryCard
            item={movingItem}
            targetTripId={moveTargetTripId}
            targetTripOptions={moveTripOptions}
            busy={moveBusy}
            error={moveError}
            onTargetTripChange={setMoveTargetTripId}
            onCancel={cancelMove}
            onMove={() => void submitMove()}
          />
        </View>
      ) : null}

      {activeTrip ? (
        <View style={styles.heroPanel}>
          <SectionHeading title={tx('行程总览', 'Trip overview')} />

          <View style={[styles.summaryStrip, compact && styles.summaryStripCompact]}>
            <View style={[styles.summaryItem, compact && styles.summaryItemCompact]}>
              <ThemedText type="smallBold">{upcomingItems.length}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{tx('安排', 'plans')}</ThemedText>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: theme.backgroundSelected }]} />
            <View style={[styles.summaryItem, compact && styles.summaryItemCompact]}>
              <ThemedText type="smallBold">{members.length}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{tx('同行', 'travellers')}</ThemedText>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: theme.backgroundSelected }]} />
            <View style={[styles.summaryItem, compact && styles.summaryItemCompact]}>
              <ThemedText type="smallBold" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{tripRange}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{tx('日期', 'dates')}</ThemedText>
            </View>
          </View>
        </View>
      ) : null}

      {activeTrip ? <ItineraryHealthCard items={upcomingItems.slice(0, 30)} onEditItem={canEdit ? beginEdit : undefined} /> : null}

      {activeTrip && canEdit && composerOpen ? (
        <View onLayout={({ nativeEvent }) => setComposerOffset(nativeEvent.layout.y)}>
          <InfoCard label={editingItem ? tx('编辑', 'Edit') : tx('新安排', 'New plan')} title={editingItem ? editingItem.title : tx('添加安排', 'Add plan')} accent={editingItem ? kindAccent(editingItem.kind) : theme.plan}>
          {editingItem ? (
            <ItineraryEditAssistant
              key={editingItem.id}
              trip={activeTrip}
              item={editingItem}
              items={itineraryItems}
              onApply={async (candidate) => {
                await saveItineraryItem({
                  itemId: candidate.id,
                  title: candidate.title,
                  locationLabel: candidate.locationLabel,
                  googlePlaceId: candidate.googlePlaceId,
                  startsAt: candidate.startsAt,
                  endsAt: candidate.endsAt,
                });
                beginEdit(candidate);
              }}
            />
          ) : null}
          <View style={styles.form}>
            <FormField label={tx('安排', 'Plan')} value={title} onChangeText={setTitle} placeholder={tx('例如：机场快线 → 中环', 'For example: Airport Express → Central')} />
            {!editingItem ? <SelectionField label={tx('类型', 'Type')} value={kind} options={itineraryKinds.map((itemKind) => ({ value: itemKind, label: kindLabel(itemKind) }))} onChange={(value) => chooseKind(value as ItineraryKind)} /> : null}
            {editingItem?.linkedStayId ? <View style={[styles.lockedDestination, { backgroundColor: theme.backgroundSelected }]}><ThemedText type="smallBold">{tx('酒店交通', 'Hotel transfer')}</ThemedText><ThemedText type="small" themeColor="textSecondary">{tx(`${editingItem.locationLabel ?? '—'} · ${formatZonedDateTimeRange(editingItem.endsAt ?? editingItem.startsAt, undefined, languageTag, tripTimeZone)}`, `${editingItem.locationLabel ?? '—'} · ${formatZonedDateTimeRange(editingItem.endsAt ?? editingItem.startsAt, undefined, languageTag, tripTimeZone)}`)}</ThemedText></View> : <LocationField value={location} onChange={(value) => { setLocation(value); setGooglePlaceId(''); }} onSelect={(suggestion) => { setLocation(suggestion.text); setGooglePlaceId(suggestion.placeId); }} />}
            {editingItem?.linkedStayId ? (
              <View style={[styles.row, compact && styles.rowCompact]}><View style={[styles.grow, compact && styles.growStacked]}><DateTimeField label={tx('日期', 'Date')} value={date} mode="date" onChange={updatePlanDate} /></View><View style={[styles.grow, compact && styles.growStacked]}><DateTimeField label={tx('时间', 'Time')} value={startTime} mode="time" onChange={setStartTime} /></View></View>
            ) : kind === 'lodging' ? (
              <>
                <View style={[styles.row, compact && styles.rowCompact]}><View style={[styles.grow, compact && styles.growStacked]}><DateTimeField label={tx('入住日期', 'Check-in')} value={date} mode="date" onChange={updatePlanDate} /></View><View style={[styles.grow, compact && styles.growStacked]}><DateTimeField label={tx('入住时间', 'Time')} value={startTime} mode="time" onChange={setStartTime} /></View></View>
                <View style={[styles.row, compact && styles.rowCompact]}><View style={[styles.grow, compact && styles.growStacked]}><DateTimeField label={tx('退房日期', 'Check-out')} value={endDate} mode="date" onChange={updatePlanEndDate} /></View><View style={[styles.grow, compact && styles.growStacked]}><DateTimeField label={tx('退房时间', 'Time')} value={endTime} mode="time" onChange={setEndTime} /></View></View>
              </>
            ) : (
              <>
                <View style={[styles.row, compact && styles.rowCompact]}><View style={[styles.grow, compact && styles.growStacked]}><DateTimeField label={tx('开始日期', 'Start date')} value={date} mode="date" onChange={updatePlanDate} /></View><View style={[styles.grow, compact && styles.growStacked]}><DateTimeField label={tx('开始时间', 'Starts')} value={startTime} mode="time" onChange={setStartTime} /></View></View>
                <View style={[styles.row, compact && styles.rowCompact]}><View style={[styles.grow, compact && styles.growStacked]}><DateTimeField label={tx('结束日期', 'End date')} value={endDate} mode="date" onChange={updatePlanEndDate} /></View><View style={[styles.grow, compact && styles.growStacked]}><DateTimeField label={tx('结束时间', 'Ends')} value={endTime} mode="time" onChange={setEndTime} /></View></View>
              </>
            )}
            {pendingTripRange ? (
              <View style={styles.rangeConfirm}>
                <InlineNotice>{tx(`这项安排超出当前行程。要把行程调整为 ${pendingTripRange.startsOn} — ${pendingTripRange.endsOn} 吗？`, `This plan is outside the current trip. Extend it to ${pendingTripRange.startsOn} — ${pendingTripRange.endsOn}?`)}</InlineNotice>
                <View style={styles.formActions}>
                  <View style={styles.actionGrow}><ActionButton tone="secondary" onPress={cancelEdit}>{tx('取消', 'Cancel')}</ActionButton></View>
                  <View style={styles.actionGrow}><ActionButton tone="secondary" onPress={() => setPendingTripRange(undefined)}>{tx('返回修改', 'Edit dates')}</ActionButton></View>
                  <View style={styles.actionGrow}><ActionButton busy={busy} onPress={() => void submitItem(true)}>{tx('调整并加入', 'Extend and add')}</ActionButton></View>
                </View>
              </View>
            ) : null}
            {confirmDeleteItem && editingItem ? (
              <View style={[styles.deleteConfirm, { borderTopColor: theme.backgroundSelected }]}>
                <ThemedText type="smallBold">{tx(`删除“${editingItem.title}”？`, `Delete “${editingItem.title}”?`)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{tx('此操作无法恢复。', 'This cannot be undone.')}</ThemedText>
                <View style={styles.formActions}>
                  <View style={styles.actionGrow}><ActionButton tone="secondary" onPress={() => setConfirmDeleteItem(false)}>{tx('保留', 'Keep')}</ActionButton></View>
                  <View style={styles.actionGrow}><Pressable accessibilityRole="button" disabled={busy} onPress={() => void deleteSelectedItem()} style={({ pressed }) => [styles.dangerConfirm, { backgroundColor: theme.danger }, pressed && styles.pressed, busy && styles.disabled]}><ThemedText type="smallBold" style={{ color: theme.textOnAccent }}>{busy ? tx('删除中…', 'Deleting…') : tx('删除', 'Delete')}</ThemedText></Pressable></View>
                </View>
              </View>
            ) : !pendingTripRange ? (
              <View style={styles.formActions}>
                <View style={styles.actionGrow}><ActionButton tone="secondary" onPress={cancelEdit}>{tx('取消', 'Cancel')}</ActionButton></View>
                <View style={styles.actionGrow}><ActionButton busy={busy} disabled={!title.trim() || (kind === 'lodging' && !location.trim())} onPress={() => void submitItem()}>{editingItem ? tx('保存', 'Save') : tx('加入行程', 'Add')}</ActionButton></View>
              </View>
            ) : null}
            {formError ? <InlineNotice tone="error">{formError}</InlineNotice> : null}
          </View>
          </InfoCard>
        </View>
      ) : null}

      {!activeTrip ? (
        <InfoCard label={tx('暂无行程', 'No trip yet')} title={tx('创建或加入共享行程', 'Create or join a shared trip')}>
          <ThemedText themeColor="textSecondary">{tx('加入后，所有成员都可以在这里查看下一项已确认的安排。', 'Once joined, everyone can see the next confirmed plan here.')}</ThemedText>
        </InfoCard>
      ) : upcomingItems.length > 0 ? (
        <>
          {visibleStays.length > 0 ? (
            <View style={styles.staySection}>
              <SectionHeading
                title={tx('住宿安排', 'Stays')}
                trailing={<ThemedText type="small" themeColor="textSecondary">{tx(`${visibleStays.length} 段`, `${visibleStays.length}`)}</ThemedText>}
              />
              {visibleStays.map((stay) => {
                const previous = previousPlaceFor(stay);
                const transferExists = itineraryItems.some((item) => item.linkedStayId === stay.id);
                const nights = stayNightsInZone(stay.startsAt, stay.endsAt, tripTimeZone);
                return (
                  <View key={stay.id} style={[styles.stayRow, compact && styles.stayRowCompact]}>
                    <StayCard
                      dateRange={formatZonedDateTimeRange(stay.startsAt, stay.endsAt, languageTag, tripTimeZone)}
                      location={stay.locationLabel ?? tx('还没设置地点', 'No place yet')}
                      nights={nights}
                      style={styles.stayCard}
                      title={stay.title}
                    />
                    <View style={[styles.stayActions, compact && styles.stayActionsCompact]}>
                      {stay.locationLabel ? (
                        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stay.locationLabel ?? '')}`)} style={({ pressed }) => [styles.stayTextAction, pressed && styles.pressed]}>
                          <ThemedText type="smallBold" style={{ color: theme.link }}>{tx('查看地图', 'Map')}</ThemedText>
                        </Pressable>
                      ) : null}
                      {itemActions(stay)}
                      {canEdit && previous?.locationLabel && stay.locationLabel ? (
                        <Pressable
                          disabled={Boolean(busyRouteId) || transferExists}
                          accessibilityRole="button"
                          accessibilityState={{ disabled: Boolean(busyRouteId) || transferExists }}
                          onPress={() => void addRouteToStay(stay)}
                          style={({ pressed }) => [styles.routeAction, compact && styles.routeActionCompact, { backgroundColor: theme.backgroundSelected }, pressed && styles.pressed, (Boolean(busyRouteId) || transferExists) && styles.disabled]}>
                          <ThemedText type="smallBold">{transferExists ? tx('已添加交通', 'Transfer added') : busyRouteId === stay.id ? tx('添加中…', 'Adding…') : tx('添加前往酒店', 'Add transfer')}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">{tx(`从 ${previous.locationLabel}`, `From ${previous.locationLabel}`)}</ThemedText>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                );
              })}
              {upcomingStays.length > visibleStays.length ? <ThemedText type="small" themeColor="textSecondary">{tx(`另有 ${upcomingStays.length - visibleStays.length} 段住宿显示在后续时间线中`, `${upcomingStays.length - visibleStays.length} more stays appear later in the timeline`)}</ThemedText> : null}
            </View>
          ) : null}
          <View style={[styles.nextRail, compact && styles.nextRailCompact, { backgroundColor: theme.backgroundElement, shadowColor: theme.shadow }]}>
            <View style={styles.nextHeading}>
              <View style={[styles.kindPill, { backgroundColor: kindAccent(upcomingItems[0].kind) }]}>
                <ThemedText type="smallBold" style={{ color: theme.textOnAccent }}>{kindLabel(upcomingItems[0].kind)}</ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">{tx('下一步', 'Up next')}</ThemedText>
            </View>
            <ThemedText type="subtitle" style={[styles.nextTitle, compact && styles.nextTitleCompact]}>{upcomingItems[0].title}</ThemedText>
            <View style={[styles.nextMetaGrid, compact && styles.nextMetaGridCompact]}>
              <View style={styles.metaChip}>
                <ThemedText type="smallBold">{tx('时间', 'When')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{formatZonedDateTimeRange(upcomingItems[0].startsAt, upcomingItems[0].endsAt, languageTag, tripTimeZone)}</ThemedText>
              </View>
              <View style={styles.metaChip}>
                <ThemedText type="smallBold">{tx('同行者', 'Who')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{tx(`${members.length} 人可见`, `${members.length} travellers can see this`)}</ThemedText>
              </View>
            </View>
            {routeDetails(upcomingItems[0])}
            {upcomingItems[0].locationLabel ? (
              <Pressable
                accessibilityRole="link"
                onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(upcomingItems[0].locationLabel ?? '')}`)}
                style={[styles.mapAction, { backgroundColor: theme.backgroundSelected }]}>
                <View style={styles.placeCopy}>
                  <ThemedText type="smallBold">{upcomingItems[0].locationLabel}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{tx('打开地图', 'Open map')}</ThemedText>
                </View>
                <Chevron color={theme.textSecondary} />
              </Pressable>
            ) : (
              <View style={[styles.mapAction, { backgroundColor: theme.backgroundSelected }]}>
                <View style={styles.placeCopy}>
                  <ThemedText type="smallBold">{tx('还没设置地点', 'No place yet')}</ThemedText>
                </View>
              </View>
            )}
            {itemActions(upcomingItems[0])}
          </View>

          {laterItems.length > 0 ? (
            <View style={styles.timelineSection}>
              <SectionHeading title={tx('后续安排', 'Later')} />
              {laterItems.map((item, index) => {
                const start = isoToZonedDateTime(item.startsAt, tripTimeZone);
                const end = item.endsAt ? isoToZonedDateTime(item.endsAt, tripTimeZone) : undefined;
                const previousDate = isoToZonedDateTime((laterItems[index - 1] ?? upcomingItems[0]).startsAt, tripTimeZone).date;
                return (
                  <Fragment key={item.id}>
                    {start.date !== previousDate ? <DaySeparator label={formatDayLabel(start.date, languageTag)} /> : null}
                    {routeSegment(item)}
                    <TimelineRow
                      startLabel={start.time}
                      endLabel={end && end.date === start.date ? end.time : undefined}
                      title={item.title}
                      place={item.locationLabel ?? undefined}
                      kindColor={kindAccent(item.kind)}
                      kindSoftColor={kindSoftAccent(item.kind)}
                      kindLabel={kindLabel(item.kind)}
                      last={index === laterItems.length - 1}>
                      {itemActions(item)}
                    </TimelineRow>
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

      {activeTrip && !canEdit ? (
        <View style={[styles.readOnlyBadge, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="smallBold">{tx('仅查看', 'View only')}</ThemedText>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14 },
  rangeConfirm: { gap: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  rowCompact: { flexDirection: 'column', gap: 12 },
  grow: { flexGrow: 1, flexBasis: 140 },
  growStacked: { flexGrow: 0, flexBasis: 'auto' },
  formActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionGrow: { flexGrow: 1, flexBasis: 150 },
  floatingAdd: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  plusIcon: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  closeIcon: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  plusHorizontal: { position: 'absolute', width: 18, height: 2, borderRadius: 1 },
  plusVertical: { position: 'absolute', width: 2, height: 18, borderRadius: 1 },
  closeDiagonalOne: { position: 'absolute', width: 18, height: 2, borderRadius: 1, transform: [{ rotate: '45deg' }] },
  closeDiagonalTwo: { position: 'absolute', width: 18, height: 2, borderRadius: 1, transform: [{ rotate: '-45deg' }] },
  lockedDestination: { borderRadius: 12, padding: 14, gap: 3 },
  deleteConfirm: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14, gap: 10 },
  dangerConfirm: { minHeight: 48, borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center' },
  heroPanel: { gap: 18, paddingVertical: 2 },
  summaryStrip: { flexDirection: 'row', alignItems: 'stretch', paddingHorizontal: 4, gap: 12 },
  summaryStripCompact: { gap: 8 },
  summaryItem: { flex: 1, minWidth: 0, alignItems: 'center', gap: 2 },
  summaryItemCompact: { flexBasis: 0 },
  summaryDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  nextRail: { borderRadius: 26, padding: 22, gap: 16, shadowOpacity: 0.08, shadowRadius: 28, shadowOffset: { width: 0, height: 10 } },
  nextRailCompact: { borderRadius: 20, padding: 18, gap: 14 },
  nextHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  nextTitle: { fontSize: 34, lineHeight: 40 },
  nextTitleCompact: { fontSize: 28, lineHeight: 34 },
  nextMetaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  nextMetaGridCompact: { gap: 8 },
  metaChip: { flexGrow: 1, flexBasis: 136, minWidth: 0, gap: 2 },
  kindPill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  mapAction: { minHeight: 68, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  placeCopy: { flex: 1 },
  timelineSection: { paddingTop: 8 },
  routeDetails: { gap: 7, paddingVertical: 4 },
  routeModeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  staySection: { gap: 10, paddingVertical: 8 },
  stayHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 },
  sectionTitle: { fontSize: 20, lineHeight: 26 },
  stayRow: { flexDirection: 'row', alignItems: 'stretch', gap: 14 },
  stayRowCompact: { flexDirection: 'column' },
  stayCard: { flex: 1 },
  stayActions: { width: 280, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  stayActionsCompact: { width: '100%', flexDirection: 'column', alignItems: 'stretch' },
  stayTextAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  itemActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  itemTextAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  routeAction: { minHeight: 48, flexGrow: 1, flexBasis: 220, maxWidth: '100%', minWidth: 0, justifyContent: 'center', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  routeActionCompact: { width: '100%', flexGrow: 0, flexBasis: 'auto' },
  stayFormGroup: { gap: 8 },
  readOnlyBadge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  pressed: { opacity: 0.68 },
  disabled: { opacity: 0.5 },
});
