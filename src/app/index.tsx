import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { DateTimeField } from '@/components/date-time-field';
import { ActionButton, ChoiceChip, FormField, InlineNotice } from '@/components/form-controls';
import { InfoCard } from '@/components/info-card';
import { LocationField } from '@/components/location-field';
import { Screen } from '@/components/screen';
import { SectionHeading } from '@/components/section-heading';
import { ThemedText } from '@/components/themed-text';
import { itineraryKindLabels, itineraryKindLabelsEn, itineraryKinds } from '@/constants/options';
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

function addMinutes(time: string, minutes: number) {
  const [hours, currentMinutes] = time.split(':').map(Number);
  const total = (hours * 60 + currentMinutes + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function getKindAccent(kind: ItineraryKind) {
  switch (kind) {
    case 'transport':
      return '#1B70A6';
    case 'lodging':
      return '#087F6A';
    case 'food':
      return '#D86E35';
    case 'activity':
      return '#0F8A6E';
    case 'task':
      return '#6E5AE6';
    case 'note':
    default:
      return '#526F7E';
  }
}

const quickTemplates: { kind: ItineraryKind; zh: string; en: string }[] = [
  { kind: 'transport', zh: '机场 / 车站接驳', en: 'Airport / station transfer' },
  { kind: 'lodging', zh: '酒店入住 / 退房', en: 'Hotel check-in / out' },
  { kind: 'food', zh: '一起吃饭', en: 'Shared meal' },
  { kind: 'activity', zh: '景点 / 演出', en: 'Activity / tickets' },
];

const routeTravelModes: RouteTravelMode[] = ['DRIVE', 'TRANSIT', 'WALK', 'BICYCLE'];

export default function TodayScreen() {
  const { locale, languageTag, tx } = useI18n();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 520;
  const { activeTrip, members, itineraryItems, error, currentUserId, addItineraryItem, addStayTransfer, saveItineraryItem, saveTrip, setItineraryRouteMode, removeItineraryItem } = useMvp();
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
  const [currentTimestamp, setCurrentTimestamp] = useState(0);
  const [editingItemId, setEditingItemId] = useState<string>();
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerOffset, setComposerOffset] = useState<number>();
  const [pendingTripRange, setPendingTripRange] = useState<{ startsOn: string; endsOn: string }>();
  const [confirmDeleteItem, setConfirmDeleteItem] = useState(false);
  const [routeEstimates, setRouteEstimates] = useState<Record<string, RouteEstimate>>({});

  const currentMember = members.find(({ userId }) => userId === currentUserId);
  const canEdit = currentMember?.role === 'owner' || currentMember?.role === 'editor';
  const upcomingItems = useMemo(() => itineraryItems.filter((item) => !currentTimestamp || new Date(item.endsAt ?? item.startsAt).getTime() >= currentTimestamp), [currentTimestamp, itineraryItems]);
  const stays = useMemo(() => itineraryItems.filter(({ kind }) => kind === 'lodging'), [itineraryItems]);
  const upcomingStays = useMemo(() => stays.filter((stay) => !currentTimestamp || new Date(stay.endsAt ?? stay.startsAt).getTime() >= currentTimestamp), [currentTimestamp, stays]);
  const visibleStays = useMemo(() => upcomingStays.slice(0, 3), [upcomingStays]);
  const tripRange = activeTrip ? formatTripDates(activeTrip.startsOn, activeTrip.endsOn, languageTag) : undefined;
  const tripTimeZone = activeTrip?.defaultTimeZone ?? 'UTC';
  const editingItem = itineraryItems.find(({ id }) => id === editingItemId);

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
        endsOn: (kind === 'lodging' ? endDate : date) > activeTrip.endsOn ? (kind === 'lodging' ? endDate : date) : activeTrip.endsOn,
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

  function beginEdit(item: ItineraryItem, deleteFirst = false) {
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

  function routeModeLabel(mode: RouteTravelMode) {
    const labels = {
      DRIVE: tx('驾车', 'Drive'),
      TRANSIT: tx('公共交通', 'Transit'),
      WALK: tx('步行', 'Walk'),
      BICYCLE: tx('骑行', 'Cycle'),
    };
    return labels[mode];
  }

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

  function transitRouteDetails(estimate?: RouteEstimate) {
    if (!estimate?.transit) return null;
    const { steps, walking } = estimate.transit;
    const walkingMinutes = Math.round(walking.durationSeconds / 60);
    return (
      <View style={[styles.transitPlan, compact && styles.transitPlanCompact, { backgroundColor: theme.backgroundSelected }]}>
        <View style={[styles.transitPlanHeading, compact && styles.transitPlanHeadingCompact]}>
          <ThemedText type="smallBold">{tx('公交路线', 'Transit route')}</ThemedText>
          {walkingMinutes > 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {tx(`含步行约 ${walkingMinutes} 分钟`, `Includes about ${walkingMinutes} min walking`)}
            </ThemedText>
          ) : null}
        </View>
        {steps.length > 0 ? steps.map((step, index) => {
          const departureTime = formatTransitTime(step.departureTime, step.departureTimeText);
          const arrivalTime = formatTransitTime(step.arrivalTime, step.arrivalTimeText);
          const rideMinutes = Math.max(1, Math.round(step.durationSeconds / 60));
          const line = step.lineName || step.vehicleName || tx('公共交通', 'Transit');
          return (
            <View key={`${step.departureStop}-${step.arrivalStop}-${index}`} style={styles.transitStep}>
              <View style={styles.transitStepMarker}>
                <ThemedText type="smallBold" style={styles.transitStepNumber}>{index + 1}</ThemedText>
              </View>
              <View style={styles.transitStepCopy}>
                <ThemedText type="smallBold">
                  {[departureTime, line].filter(Boolean).join(' · ')}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {step.departureStop || tx('上车站', 'Boarding stop')} → {step.arrivalStop || tx('下车站', 'Arrival stop')}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {tx(`${step.stopCount} 站 · 约 ${rideMinutes} 分钟`, `${step.stopCount} stops · about ${rideMinutes} min`)}
                  {arrivalTime ? tx(` · ${arrivalTime} 到达`, ` · arrives ${arrivalTime}`) : ''}
                </ThemedText>
                {step.headsign ? <ThemedText type="small" themeColor="textSecondary">{tx(`开往 ${step.headsign}`, `Towards ${step.headsign}`)}</ThemedText> : null}
              </View>
            </View>
          );
        }) : (
          <ThemedText type="small" themeColor="textSecondary">{tx('当前路线暂无具体班次信息。', 'Detailed service information is not available for this route.')}</ThemedText>
        )}
      </View>
    );
  }

  async function changeRouteMode(item: ItineraryItem, travelMode: RouteTravelMode) {
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

  function routeDetails(item: ItineraryItem) {
    const itemIndex = itineraryItems.findIndex(({ id }) => id === item.id);
    const previous = itemIndex > 0 ? itineraryItems[itemIndex - 1] : undefined;
    if (!previous?.googlePlaceId || !item.googlePlaceId) return null;
    const estimate = formatRouteEstimate(routeEstimates[item.id]);
    return (
      <View style={styles.routeDetails}>
        <View style={styles.routeModeRow}>
          {canEdit ? routeTravelModes.map((mode) => (
            <ChoiceChip
              key={mode}
              selected={item.routeTravelMode === mode}
              disabled={Boolean(busyTravelModeId)}
              onPress={() => void changeRouteMode(item, mode)}>
              {routeModeLabel(mode)}
            </ChoiceChip>
          )) : <ThemedText type="smallBold">{routeModeLabel(item.routeTravelMode)}</ThemedText>}
        </View>
        <ThemedText type="smallBold" style={styles.routeEstimate}>
          {busyTravelModeId === item.id ? tx('正在重新计算…', 'Recalculating…') : estimate ?? tx('此方式暂无可用路线', 'No route available for this mode')}
        </ThemedText>
        {item.routeTravelMode === 'TRANSIT' && busyTravelModeId !== item.id ? transitRouteDetails(routeEstimates[item.id]) : null}
      </View>
    );
  }

  function itemActions(item: ItineraryItem) {
    if (!canEdit) return null;
    return (
      <View style={styles.itemActions}>
        <Pressable accessibilityRole="button" onPress={() => beginEdit(item)} style={({ pressed }) => [styles.itemTextAction, pressed && styles.pressed]}><ThemedText type="smallBold" style={styles.linkText}>{tx('编辑', 'Edit')}</ThemedText></Pressable>
        <Pressable accessibilityRole="button" onPress={() => beginEdit(item, true)} style={({ pressed }) => [styles.itemTextAction, pressed && styles.pressed]}><ThemedText type="smallBold" style={{ color: theme.danger }}>{tx('删除', 'Delete')}</ThemedText></Pressable>
      </View>
    );
  }

  return (
    <Screen
      scrollToKey={composerOpen ? (editingItemId ?? 'new-plan') : undefined}
      scrollToOffset={composerOffset}
      meta={activeTrip ? tripRange : tx('今天', 'Today')}
      title={activeTrip?.name ?? tx('把旅程安排成一条可执行的流', 'Turn the trip into one shared flow')}
      subtitle={activeTrip ? tx('下一项安排', 'Next up') : tx('从“行程”创建或加入一个行程。', 'Create or join a trip from Trips.')}
      floatingAction={activeTrip && canEdit ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={composerOpen ? tx('关闭添加安排', 'Close add plan') : tx('添加安排', 'Add plan')}
          accessibilityState={{ expanded: composerOpen }}
          onPress={() => {
            if (composerOpen) {
              cancelEdit();
              return;
            }
            openNewComposer();
          }}
          style={({ pressed }) => [styles.floatingAdd, pressed && styles.pressed]}>
          <View style={styles.plusIcon}>
            <View style={styles.plusHorizontal} />
            <View style={styles.plusVertical} />
          </View>
        </Pressable>
      ) : null}
    >
      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
      {success ? <InlineNotice>{success}</InlineNotice> : null}

      {activeTrip ? (
        <View style={styles.heroPanel}>
          <View style={styles.heroTop}>
            <View style={styles.heroCopy}>
              <SectionHeading
                title={tx('行程总览', 'Trip overview')}
              />
            </View>
            <View style={[styles.heroBadge, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="smallBold">{activeTrip.homeCurrency}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{tx('本位币', 'base')}</ThemedText>
            </View>
          </View>

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

      {activeTrip && canEdit && composerOpen ? (
        <View onLayout={({ nativeEvent }) => setComposerOffset(nativeEvent.layout.y)}>
          <InfoCard label={editingItem ? tx('编辑', 'Edit') : tx('新安排', 'New plan')} title={editingItem ? editingItem.title : tx('添加安排', 'Add plan')} accent={editingItem ? getKindAccent(editingItem.kind) : '#D86E35'}>
          <View style={styles.form}>
            {editingItem ? null : <View style={styles.templateWrap}>
              {quickTemplates.map((template) => (
                <ChoiceChip
                  key={template.zh}
                  selected={title === (locale === 'zh-CN' ? template.zh : template.en)}
                  onPress={() => {
                    setTitle(locale === 'zh-CN' ? template.zh : template.en);
                    chooseKind(template.kind);
                  }}>
                  {locale === 'zh-CN' ? template.zh : template.en}
                </ChoiceChip>
              ))}
            </View>}
            <FormField label={tx('安排', 'Plan')} value={title} onChangeText={setTitle} placeholder={tx('例如：机场快线 → 中环', 'For example: Airport Express → Central')} />
            {editingItem?.linkedStayId ? <View style={[styles.lockedDestination, { backgroundColor: theme.backgroundSelected }]}><ThemedText type="smallBold">{tx('酒店交通', 'Hotel transfer')}</ThemedText><ThemedText type="small" themeColor="textSecondary">{tx(`${editingItem.locationLabel ?? '—'} · ${formatZonedDateTimeRange(editingItem.endsAt ?? editingItem.startsAt, undefined, languageTag, tripTimeZone)}`, `${editingItem.locationLabel ?? '—'} · ${formatZonedDateTimeRange(editingItem.endsAt ?? editingItem.startsAt, undefined, languageTag, tripTimeZone)}`)}</ThemedText></View> : <LocationField value={location} onChange={(value) => { setLocation(value); setGooglePlaceId(''); }} onSelect={(suggestion) => { setLocation(suggestion.text); setGooglePlaceId(suggestion.placeId); }} />}
            {editingItem?.linkedStayId ? (
              <View style={styles.row}><View style={styles.dateField}><DateTimeField label={tx('日期', 'Date')} value={date} mode="date" onChange={updatePlanDate} /></View><View style={styles.grow}><DateTimeField label={tx('时间', 'Time')} value={startTime} mode="time" onChange={setStartTime} /></View></View>
            ) : kind === 'lodging' ? (
              <>
                <View style={styles.row}><View style={styles.dateField}><DateTimeField label={tx('入住日期', 'Check-in')} value={date} mode="date" onChange={(value) => { updatePlanDate(value); if (endDate < value) updatePlanEndDate(value); }} /></View><View style={styles.grow}><DateTimeField label={tx('入住时间', 'Time')} value={startTime} mode="time" onChange={setStartTime} /></View></View>
                <View style={styles.row}><View style={styles.dateField}><DateTimeField label={tx('退房日期', 'Check-out')} value={endDate} mode="date" onChange={updatePlanEndDate} /></View><View style={styles.grow}><DateTimeField label={tx('退房时间', 'Time')} value={endTime} mode="time" onChange={setEndTime} /></View></View>
              </>
            ) : (
              <View style={styles.row}><View style={styles.dateField}><DateTimeField label={tx('日期', 'Date')} value={date} mode="date" onChange={updatePlanDate} /></View><View style={styles.grow}><DateTimeField label={tx('开始', 'Starts')} value={startTime} mode="time" onChange={setStartTime} /></View><View style={styles.grow}><DateTimeField label={tx('结束', 'Ends')} value={endTime} mode="time" onChange={setEndTime} /></View></View>
            )}
            {kind !== 'lodging' ? <View style={styles.durationRow}>{[30, 60, 120, 180].map((minutes) => <ChoiceChip key={minutes} selected={endTime === addMinutes(startTime, minutes)} onPress={() => setEndTime(addMinutes(startTime, minutes))}>{minutes < 60 ? `${minutes}m` : `${minutes / 60}h`}</ChoiceChip>)}</View> : null}
            {!editingItem ? <View style={styles.chips}>{itineraryKinds.map((itemKind) => <ChoiceChip key={itemKind} selected={kind === itemKind} onPress={() => chooseKind(itemKind)}>{kindLabel(itemKind)}</ChoiceChip>)}</View> : null}
            {pendingTripRange ? (
              <View style={styles.rangeConfirm}>
                <InlineNotice>{tx(`这项安排超出当前行程。要把行程调整为 ${pendingTripRange.startsOn} — ${pendingTripRange.endsOn} 吗？`, `This plan is outside the current trip. Extend it to ${pendingTripRange.startsOn} — ${pendingTripRange.endsOn}?`)}</InlineNotice>
                <View style={styles.formActions}>
                  <View style={styles.actionGrow}><ActionButton tone="secondary" onPress={() => setPendingTripRange(undefined)}>{tx('返回修改', 'Edit dates')}</ActionButton></View>
                  <View style={styles.actionGrow}><ActionButton busy={busy} onPress={() => void submitItem(true)}>{tx('调整并加入', 'Extend and add')}</ActionButton></View>
                </View>
              </View>
            ) : null}
            {confirmDeleteItem && editingItem ? <View style={[styles.deleteConfirm, { borderTopColor: theme.backgroundSelected }]}><ThemedText type="smallBold">{tx(`删除“${editingItem.title}”？`, `Delete “${editingItem.title}”?`)}</ThemedText><ThemedText type="small" themeColor="textSecondary">{tx('此操作无法恢复。', 'This cannot be undone.')}</ThemedText><View style={styles.formActions}><View style={styles.actionGrow}><ActionButton tone="secondary" onPress={() => setConfirmDeleteItem(false)}>{tx('保留', 'Keep')}</ActionButton></View><View style={styles.actionGrow}><Pressable accessibilityRole="button" disabled={busy} onPress={() => void deleteSelectedItem()} style={({ pressed }) => [styles.dangerConfirm, pressed && styles.pressed, busy && styles.disabled]}><ThemedText type="smallBold" style={styles.dangerConfirmText}>{busy ? tx('删除中…', 'Deleting…') : tx('删除', 'Delete')}</ThemedText></Pressable></View></View></View> : !pendingTripRange ? <View style={styles.formActions}>{editingItem ? <View style={styles.actionGrow}><ActionButton tone="secondary" onPress={cancelEdit}>{tx('取消', 'Cancel')}</ActionButton></View> : null}<View style={styles.actionGrow}><ActionButton busy={busy} disabled={!title.trim() || (kind === 'lodging' && !location.trim())} onPress={() => void submitItem()}>{editingItem ? tx('保存', 'Save') : tx('加入行程', 'Add')}</ActionButton></View></View> : null}
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
              {visibleStays.map((stay, index) => {
                const previous = previousPlaceFor(stay);
                const transferExists = itineraryItems.some((item) => item.linkedStayId === stay.id);
                return (
                  <View key={stay.id}>
                    {index > 0 ? <View style={[styles.stayDivider, { backgroundColor: theme.backgroundSelected }]} /> : null}
                    <View style={styles.stayRow}>
                      <View style={styles.stayCopy}>
                        <ThemedText type="smallBold">{stay.title}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {formatZonedDateTimeRange(stay.startsAt, stay.endsAt, languageTag, tripTimeZone)} · {tx(`${stayNightsInZone(stay.startsAt, stay.endsAt, tripTimeZone)} 晚`, `${stayNightsInZone(stay.startsAt, stay.endsAt, tripTimeZone)} nights`)}
                        </ThemedText>
                        {stay.locationLabel ? <ThemedText type="small" themeColor="textSecondary">{stay.locationLabel}</ThemedText> : null}
                      </View>
                    <View style={[styles.stayActions, compact && styles.stayActionsCompact]}>
                        {stay.locationLabel ? (
                          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stay.locationLabel ?? '')}`)} style={({ pressed }) => [styles.stayTextAction, pressed && styles.pressed]}>
                            <ThemedText type="smallBold" style={styles.linkText}>{tx('查看地图', 'Map')}</ThemedText>
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
                  </View>
                );
              })}
              {upcomingStays.length > visibleStays.length ? <ThemedText type="small" themeColor="textSecondary">{tx(`另有 ${upcomingStays.length - visibleStays.length} 段住宿显示在后续时间线中`, `${upcomingStays.length - visibleStays.length} more stays appear later in the timeline`)}</ThemedText> : null}
            </View>
          ) : null}
          <View style={[styles.nextRail, compact && styles.nextRailCompact, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.nextHeading}>
              <View style={[styles.kindPill, { backgroundColor: getKindAccent(upcomingItems[0].kind) }]}>
                <ThemedText type="smallBold" style={styles.kindPillText}>{kindLabel(upcomingItems[0].kind)}</ThemedText>
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
                  <ThemedText type="small" themeColor="textSecondary">{tx('一键打开 Google 地图查看路线', 'Open in Google Maps for directions')} ›</ThemedText>
                </View>
              </Pressable>
            ) : (
              <View style={[styles.mapAction, { backgroundColor: theme.backgroundSelected }]}>
                <View style={styles.placeCopy}>
                  <ThemedText type="smallBold">{tx('还没设置地点', 'No place yet')}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{tx('补上地点后，大家会更容易集合和导航。', 'Add a place so the group can meet and navigate faster.')}</ThemedText>
                </View>
              </View>
            )}
            {itemActions(upcomingItems[0])}
          </View>

          {upcomingItems.length > 1 ? (
            <View style={styles.timelineSection}>
              <SectionHeading title={tx('后续安排', 'Later')} />
              {upcomingItems.slice(1).filter((item) => item.kind !== 'lodging' || !visibleStays.some((stay) => stay.id === item.id)).map((item) => (
                <View key={item.id} style={styles.timelineRow}>
                  <View style={[styles.timelineRail, { borderRightColor: theme.backgroundSelected }]}>
                    <View style={styles.timelineDot} />
                  </View>
                  <View style={styles.timelineContent}>
                    <View style={styles.timelineHeader}>
                      <View style={styles.timelineHeading}>
                        <ThemedText type="small" themeColor="textSecondary">{formatZonedDateTimeRange(item.startsAt, item.endsAt, languageTag, tripTimeZone)}</ThemedText>
                        <ThemedText type="smallBold">{item.title}</ThemedText>
                      </View>
                      <View style={[styles.kindOutline, { borderColor: getKindAccent(item.kind) }]}>
                        <ThemedText type="small" style={{ color: getKindAccent(item.kind) }}>{kindLabel(item.kind)}</ThemedText>
                      </View>
                    </View>
                    {item.locationLabel ? <ThemedText type="small" themeColor="textSecondary">{item.locationLabel}</ThemedText> : null}
                    {routeDetails(item)}
                    {itemActions(item)}
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <InfoCard label={tx('时间线已就绪', 'Timeline ready')} title={tx('还没有安排', 'Nothing planned yet')}>
          <ThemedText themeColor="textSecondary">{tx('点击“添加安排”开始。', 'Choose Add plan to start.')}</ThemedText>
        </InfoCard>
      )}

      {activeTrip && !canEdit ? (
        <InlineNotice>{tx('你当前是仅查看成员，可以查看共享时间线，但不能编辑。', 'You can view this shared timeline, but your current role cannot edit it.')}</InlineNotice>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14 },
  rangeConfirm: { gap: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  grow: { flexGrow: 1, flexBasis: 140 },
  dateField: { flexGrow: 2, flexBasis: 200 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  templateWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  formActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionGrow: { flexGrow: 1, flexBasis: 150 },
  floatingAdd: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#087F6A', alignItems: 'center', justifyContent: 'center', shadowColor: '#17324D', shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  plusIcon: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  plusHorizontal: { position: 'absolute', width: 18, height: 2, borderRadius: 1, backgroundColor: '#FFFFFF' },
  plusVertical: { position: 'absolute', width: 2, height: 18, borderRadius: 1, backgroundColor: '#FFFFFF' },
  lockedDestination: { borderRadius: 12, padding: 14, gap: 3 },
  deleteConfirm: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14, gap: 10 },
  dangerConfirm: { minHeight: 48, borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: '#B4413E' },
  dangerConfirmText: { color: '#FFFFFF' },
  heroPanel: { gap: 18, paddingVertical: 2 },
  heroTop: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  heroCopy: { flex: 1, gap: 6 },
  heroBadge: { minWidth: 74, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center', gap: 2 },
  summaryStrip: { flexDirection: 'row', alignItems: 'stretch', paddingHorizontal: 4, gap: 12 },
  summaryStripCompact: { gap: 8 },
  summaryItem: { flex: 1, minWidth: 0, alignItems: 'center', gap: 2 },
  summaryItemCompact: { flexBasis: 0 },
  summaryDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  nextRail: { borderRadius: 26, padding: 22, gap: 16, shadowColor: '#17324D', shadowOpacity: 0.08, shadowRadius: 28, shadowOffset: { width: 0, height: 10 } },
  nextRailCompact: { borderRadius: 20, padding: 18, gap: 14 },
  nextHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  nextTitle: { fontSize: 34, lineHeight: 40 },
  nextTitleCompact: { fontSize: 28, lineHeight: 34 },
  nextMetaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  nextMetaGridCompact: { gap: 8 },
  metaChip: { flexGrow: 1, flexBasis: 136, minWidth: 0, gap: 2 },
  kindPill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  kindPillText: { color: '#FFFFFF' },
  kindOutline: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'center' },
  mapAction: { minHeight: 68, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  placeCopy: { flex: 1 },
  timelineSection: { gap: 6, paddingTop: 8 },
  timelineRow: { minHeight: 76, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  timelineRail: { width: 16, alignItems: 'center', height: '100%', borderRightWidth: 1 },
  timelineDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#1B70A6', marginRight: -1, marginTop: 7 },
  timelineContent: { flex: 1, minWidth: 0, gap: 2, paddingBottom: 16 },
  timelineHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  timelineHeading: { flex: 1, minWidth: 0, gap: 2 },
  routeEstimate: { color: '#087F6A' },
  routeDetails: { gap: 7, paddingVertical: 4 },
  routeModeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  transitPlan: { borderRadius: 14, padding: 12, gap: 10 },
  transitPlanCompact: { padding: 10, gap: 8 },
  transitPlanHeading: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  transitPlanHeadingCompact: { flexDirection: 'column', alignItems: 'flex-start', gap: 2 },
  transitStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  transitStepMarker: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1B70A6' },
  transitStepNumber: { color: '#FFFFFF' },
  transitStepCopy: { flex: 1, minWidth: 0, gap: 2 },
  durationRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  staySection: { gap: 10, paddingVertical: 8 },
  stayHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 },
  sectionTitle: { fontSize: 20, lineHeight: 26 },
  stayRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 14, paddingVertical: 10 },
  stayCopy: { flex: 1, minWidth: 0, gap: 2 },
  stayActions: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  stayActionsCompact: { flexDirection: 'column', alignItems: 'stretch' },
  stayTextAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  itemActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  itemTextAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  routeAction: { minHeight: 48, flexGrow: 1, flexBasis: 220, maxWidth: '100%', minWidth: 0, justifyContent: 'center', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  routeActionCompact: { width: '100%', flexGrow: 0, flexBasis: 'auto' },
  stayDivider: { height: StyleSheet.hairlineWidth },
  stayFormGroup: { gap: 8 },
  linkText: { color: '#1B70A6' },
  pressed: { opacity: 0.68 },
  disabled: { opacity: 0.5 },
});
