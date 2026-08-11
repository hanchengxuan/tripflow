import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { DateTimeField } from '@/components/date-time-field';
import { ActionButton, ChoiceChip, FormField, InlineNotice } from '@/components/form-controls';
import { InfoCard } from '@/components/info-card';
import { LocationField } from '@/components/location-field';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { itineraryKindLabels, itineraryKindLabelsEn, itineraryKinds } from '@/constants/options';
import type { ItineraryKind } from '@/domain/models';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useMvp } from '@/features/mvp/mvp-provider';
import { toUserMessage } from '@/lib/user-error';
import { formatZonedDateTimeRange, stayNightsInZone, zonedDateTimeToIso } from '@/lib/trip-time';
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

export default function TodayScreen() {
  const { locale, languageTag, tx } = useI18n();
  const theme = useTheme();
  const { activeTrip, members, itineraryItems, loading, error, currentUserId, addItineraryItem, addStayTransfer } = useMvp();
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(activeTrip?.startsOn ?? new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(activeTrip?.startsOn ?? new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:30');
  const [kind, setKind] = useState<ItineraryKind>('activity');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [busyRouteId, setBusyRouteId] = useState<string>();
  const [currentTimestamp, setCurrentTimestamp] = useState(0);

  const currentMember = members.find(({ userId }) => userId === currentUserId);
  const canEdit = currentMember?.role === 'owner' || currentMember?.role === 'editor';
  const upcomingItems = useMemo(() => itineraryItems.filter((item) => !currentTimestamp || new Date(item.endsAt ?? item.startsAt).getTime() >= currentTimestamp), [currentTimestamp, itineraryItems]);
  const stays = useMemo(() => itineraryItems.filter(({ kind }) => kind === 'lodging'), [itineraryItems]);
  const upcomingStays = useMemo(() => stays.filter((stay) => !currentTimestamp || new Date(stay.endsAt ?? stay.startsAt).getTime() >= currentTimestamp), [currentTimestamp, stays]);
  const visibleStays = useMemo(() => upcomingStays.slice(0, 3), [upcomingStays]);
  const tripRange = activeTrip ? formatTripDates(activeTrip.startsOn, activeTrip.endsOn, languageTag) : undefined;
  const tripTimeZone = activeTrip?.defaultTimeZone ?? 'UTC';

  useEffect(() => {
    if (!activeTrip) return;
    const timeout = setTimeout(() => {
      setDate(activeTrip.startsOn);
      setEndDate(activeTrip.startsOn);
      setCurrentTimestamp(Date.now());
    }, 0);
    return () => clearTimeout(timeout);
  }, [activeTrip]);

  async function submitItem() {
    setBusy(true);
    setFormError(undefined);
    setSuccess(undefined);
    try {
      if (kind === 'lodging' && !location.trim()) throw new Error(tx('请先选择酒店或住宿地点。', 'Choose the hotel or stay location first.'));
      const startsAt = zonedDateTimeToIso(date, startTime, tripTimeZone);
      const endsAt = zonedDateTimeToIso(kind === 'lodging' ? endDate : date, endTime, tripTimeZone);
      if (new Date(endsAt) <= new Date(startsAt)) throw new Error(tx('结束时间需要晚于开始时间。', 'End time must be later than start time.'));
      await addItineraryItem({ title, locationLabel: location, kind, startsAt, endsAt });
      setTitle('');
      setLocation('');
      setSuccess(kind === 'lodging'
        ? tx('住宿已按入住区间加入，不需要每天重复添加。', 'Stay added for the full date range. No daily duplicates needed.')
        : tx('安排已加入共享时间线。', 'Plan added to the shared timeline.'));
    } catch (caught) {
      setFormError(toUserMessage(caught, tx('无法添加行程安排，请稍后重试。', 'Could not add this plan. Please try again.')));
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

  return (
    <Screen
      meta={activeTrip ? tripRange : tx('今天', 'Today')}
      title={activeTrip?.name ?? tx('把旅程安排成一条可执行的流', 'Turn the trip into one shared flow')}
      subtitle={activeTrip ? tx('先看下一步，再决定集合、出发和分工。', 'See the next move first, then align on when, where, and who is involved.') : tx('请先从“行程”页面创建或加入一个行程。', 'Create or join a trip from the Trips tab.')}>
      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
      {loading ? <InlineNotice>{tx('正在刷新共享时间线…', 'Refreshing the shared timeline…')}</InlineNotice> : null}
      {success ? <InlineNotice>{success}</InlineNotice> : null}

      {activeTrip ? (
        <View style={[styles.heroPanel, { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.heroTop}>
            <View style={styles.heroCopy}>
              <ThemedText type="smallBold" style={{ color: '#087F6A' }}>{tx('行程驾驶舱', 'Trip cockpit')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {tx('别再把安排散在聊天和备忘录里。这里应该回答大家现在最关心的下一步。', 'Stop scattering plans across chat and notes. This page should answer what everyone needs next.')}
              </ThemedText>
            </View>
            <View style={[styles.heroBadge, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="smallBold">{activeTrip.homeCurrency}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{tx('本位币', 'base')}</ThemedText>
            </View>
          </View>

          <View style={styles.summaryStrip}>
            <View style={styles.summaryItem}>
              <ThemedText type="smallBold">{upcomingItems.length}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{tx('项已确认安排', 'confirmed plans')}</ThemedText>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: theme.backgroundSelected }]} />
            <View style={styles.summaryItem}>
              <ThemedText type="smallBold">{members.length}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{tx('位同行者在线协作', 'travellers aligned')}</ThemedText>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: theme.backgroundSelected }]} />
            <View style={styles.summaryItem}>
              <ThemedText type="smallBold">{tripRange}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{tx('这趟旅程窗口', 'trip window')}</ThemedText>
            </View>
          </View>
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
              <View style={styles.stayHeading}>
                <View><ThemedText type="smallBold" style={styles.sectionTitle}>{tx('住宿安排', 'Stays')}</ThemedText><ThemedText type="small" themeColor="textSecondary">{tx('一次记录完整入住区间，每天自动沿用。', 'One stay covers the full date range.')}</ThemedText></View>
                <ThemedText type="small" themeColor="textSecondary">{tx(`${visibleStays.length} 段近期住宿`, `${visibleStays.length} upcoming stay${visibleStays.length === 1 ? '' : 's'}`)}</ThemedText>
              </View>
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
                      <View style={styles.stayActions}>
                        {stay.locationLabel ? (
                          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stay.locationLabel ?? '')}`)} style={({ pressed }) => [styles.stayTextAction, pressed && styles.pressed]}>
                            <ThemedText type="smallBold" style={styles.linkText}>{tx('查看地图', 'Map')}</ThemedText>
                          </Pressable>
                        ) : null}
                        {canEdit && previous?.locationLabel && stay.locationLabel ? (
                          <Pressable
                            disabled={Boolean(busyRouteId) || transferExists}
                            accessibilityRole="button"
                            accessibilityState={{ disabled: Boolean(busyRouteId) || transferExists }}
                            onPress={() => void addRouteToStay(stay)}
                            style={({ pressed }) => [styles.routeAction, { backgroundColor: theme.backgroundSelected }, pressed && styles.pressed, (Boolean(busyRouteId) || transferExists) && styles.disabled]}>
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
          <View style={[styles.nextRail, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.nextHeading}>
              <View style={[styles.kindPill, { backgroundColor: getKindAccent(upcomingItems[0].kind) }]}>
                <ThemedText type="smallBold" style={styles.kindPillText}>{kindLabel(upcomingItems[0].kind)}</ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">{tx('下一步', 'Up next')}</ThemedText>
            </View>
            <ThemedText type="subtitle" style={styles.nextTitle}>{upcomingItems[0].title}</ThemedText>
            <View style={styles.nextMetaGrid}>
              <View style={styles.metaChip}>
                <ThemedText type="smallBold">{tx('时间', 'When')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{formatZonedDateTimeRange(upcomingItems[0].startsAt, upcomingItems[0].endsAt, languageTag, tripTimeZone)}</ThemedText>
              </View>
              <View style={styles.metaChip}>
                <ThemedText type="smallBold">{tx('同行者', 'Who')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{tx(`${members.length} 人可见`, `${members.length} travellers can see this`)}</ThemedText>
              </View>
            </View>
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
          </View>

          {upcomingItems.length > 1 ? (
            <View style={styles.timelineSection}>
              <ThemedText type="smallBold">{tx('后续安排', 'Later in the flow')}</ThemedText>
              {upcomingItems.slice(1).filter((item) => item.kind !== 'lodging' || !visibleStays.some((stay) => stay.id === item.id)).map((item) => (
                <View key={item.id} style={styles.timelineRow}>
                  <View style={[styles.timelineRail, { borderRightColor: theme.backgroundSelected }]}>
                    <View style={styles.timelineDot} />
                  </View>
                  <View style={styles.timelineContent}>
                    <ThemedText type="small" themeColor="textSecondary">{formatZonedDateTimeRange(item.startsAt, item.endsAt, languageTag, tripTimeZone)}</ThemedText>
                    <ThemedText type="smallBold">{item.title}</ThemedText>
                    {item.locationLabel ? <ThemedText type="small" themeColor="textSecondary">{item.locationLabel}</ThemedText> : null}
                  </View>
                  <View style={[styles.kindOutline, { borderColor: getKindAccent(item.kind) }]}>
                    <ThemedText type="small" style={{ color: getKindAccent(item.kind) }}>{kindLabel(item.kind)}</ThemedText>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <InfoCard label={tx('时间线已就绪', 'Timeline ready')} title={tx('还没有安排', 'Nothing planned yet')}>
          <ThemedText themeColor="textSecondary">{tx('在下方添加第一项共享安排。', 'Add the first shared plan below.')}</ThemedText>
        </InfoCard>
      )}

      {activeTrip && canEdit ? (
        <InfoCard label={tx('规划下一站', 'Plan the next stop')} title={tx('把新安排放进共享时间线', 'Add a useful next move')} accent="#D86E35">
          <View style={styles.form}>
            <ThemedText type="small" themeColor="textSecondary">
              {tx('优先记录真正会影响出发、集合、交通、入住和门票的安排，而不是普通备忘录。', 'Prioritize plans that change departure, meetups, transport, check-ins, or tickets instead of generic notes.')}
            </ThemedText>
            <View style={styles.templateWrap}>
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
            </View>
            <FormField label={tx('要做什么？', 'What are you doing?')} value={title} onChangeText={setTitle} placeholder={tx('例如：乘机场快线前往中环', 'For example: Airport Express to Central')} />
            <LocationField value={location} onChange={setLocation} />
            {kind === 'lodging' ? <><View style={styles.stayFormGroup}><ThemedText type="smallBold">{tx('入住', 'Check-in')}</ThemedText><View style={styles.row}><View style={styles.dateField}><DateTimeField label={tx('入住日期', 'Check-in date')} value={date} mode="date" minimumDate={new Date(`${activeTrip.startsOn}T12:00:00`)} maximumDate={new Date(`${activeTrip.endsOn}T12:00:00`)} onChange={(value) => { setDate(value); if (endDate < value) setEndDate(value); }} /></View><View style={styles.grow}><DateTimeField label={tx('入住时间', 'Check-in time')} value={startTime} mode="time" onChange={setStartTime} /></View></View></View><View style={styles.stayFormGroup}><ThemedText type="smallBold">{tx('退房', 'Check-out')}</ThemedText><View style={styles.row}><View style={styles.dateField}><DateTimeField label={tx('退房日期', 'Check-out date')} value={endDate} mode="date" minimumDate={new Date(`${date}T12:00:00`)} maximumDate={new Date(`${activeTrip.endsOn}T12:00:00`)} onChange={setEndDate} /></View><View style={styles.grow}><DateTimeField label={tx('退房时间', 'Check-out time')} value={endTime} mode="time" onChange={setEndTime} /></View></View></View><ThemedText type="small" themeColor="textSecondary">{tx(`这段住宿会覆盖 ${stayNightsInZone(zonedDateTimeToIso(date, startTime, tripTimeZone), zonedDateTimeToIso(endDate, endTime, tripTimeZone), tripTimeZone)} 晚，不会生成重复的每日项目。`, `This stay covers ${stayNightsInZone(zonedDateTimeToIso(date, startTime, tripTimeZone), zonedDateTimeToIso(endDate, endTime, tripTimeZone), tripTimeZone)} nights without duplicate daily items.`)}</ThemedText></> : <View style={styles.row}><View style={styles.dateField}><DateTimeField label={tx('日期', 'Date')} value={date} mode="date" minimumDate={new Date(`${activeTrip.startsOn}T12:00:00`)} maximumDate={new Date(`${activeTrip.endsOn}T12:00:00`)} onChange={setDate} /></View><View style={styles.grow}><DateTimeField label={tx('开始', 'Starts')} value={startTime} mode="time" onChange={setStartTime} /></View><View style={styles.grow}><DateTimeField label={tx('结束', 'Ends')} value={endTime} mode="time" onChange={setEndTime} /></View></View>}
            {kind !== 'lodging' ? <View style={styles.durationRow}>
              <ThemedText type="small" themeColor="textSecondary">{tx('快速设置时长', 'Quick duration')}</ThemedText>
              {[30, 60, 120, 180].map((minutes) => (
                <ChoiceChip key={minutes} selected={endTime === addMinutes(startTime, minutes)} onPress={() => setEndTime(addMinutes(startTime, minutes))}>
                  {minutes < 60 ? `${minutes}m` : `${minutes / 60}h`}
                </ChoiceChip>
              ))}
            </View> : null}
            <View style={styles.chips}>
              {itineraryKinds.map((itemKind) => (
                <ChoiceChip key={itemKind} selected={kind === itemKind} onPress={() => chooseKind(itemKind)}>{kindLabel(itemKind)}</ChoiceChip>
              ))}
            </View>
            <ActionButton busy={busy} disabled={!title.trim() || (kind === 'lodging' && !location.trim())} onPress={submitItem}>{tx('加入时间线', 'Add to timeline')}</ActionButton>
            {formError ? <InlineNotice tone="error">{formError}</InlineNotice> : null}
          </View>
        </InfoCard>
      ) : activeTrip ? (
        <InlineNotice>{tx('你当前是仅查看成员，可以查看共享时间线，但不能编辑。', 'You can view this shared timeline, but your current role cannot edit it.')}</InlineNotice>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  grow: { flexGrow: 1, flexBasis: 140 },
  dateField: { flexGrow: 2, flexBasis: 200 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  templateWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  heroPanel: { borderRadius: 24, padding: 20, gap: 18, shadowColor: '#17324D', shadowOpacity: 0.07, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } },
  heroTop: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  heroCopy: { flex: 1, gap: 6 },
  heroBadge: { minWidth: 74, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center', gap: 2 },
  summaryStrip: { flexDirection: 'row', alignItems: 'stretch', paddingHorizontal: 4, gap: 12 },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  summaryDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  nextRail: { borderRadius: 26, padding: 22, gap: 16, shadowColor: '#17324D', shadowOpacity: 0.08, shadowRadius: 28, shadowOffset: { width: 0, height: 10 } },
  nextHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  nextTitle: { fontSize: 34, lineHeight: 40 },
  nextMetaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metaChip: { minWidth: 136, gap: 2 },
  kindPill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  kindPillText: { color: '#FFFFFF' },
  kindOutline: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'center' },
  mapAction: { minHeight: 68, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  placeCopy: { flex: 1 },
  timelineSection: { gap: 6, paddingTop: 8 },
  timelineRow: { minHeight: 76, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  timelineRail: { width: 16, alignItems: 'center', height: '100%', borderRightWidth: 1 },
  timelineDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#1B70A6', marginRight: -1, marginTop: 7 },
  timelineContent: { flex: 1, gap: 2, paddingBottom: 16 },
  durationRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  staySection: { gap: 10, paddingVertical: 8 },
  stayHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 },
  sectionTitle: { fontSize: 20, lineHeight: 26 },
  stayRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14, paddingVertical: 10 },
  stayCopy: { flex: 1, minWidth: 210, gap: 2 },
  stayActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  stayTextAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  routeAction: { minHeight: 48, maxWidth: 240, minWidth: 150, justifyContent: 'center', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  stayDivider: { height: StyleSheet.hairlineWidth },
  stayFormGroup: { gap: 8 },
  linkText: { color: '#1B70A6' },
  pressed: { opacity: 0.68 },
  disabled: { opacity: 0.5 },
});
