import { useMemo, useState } from 'react';
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
import { useTheme } from '@/hooks/use-theme';

function formatDateTimeRange(startsAt: string, endsAt: string | undefined, locale: string) {
  const start = new Date(startsAt);
  const date = start.toLocaleDateString(locale, { month: 'short', day: 'numeric', weekday: 'short' });
  const startTime = start.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
  if (!endsAt) return `${date} · ${startTime}`;
  const endTime = new Date(endsAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} · ${startTime}–${endTime}`;
}

function addMinutes(time: string, minutes: number) {
  const [hours, currentMinutes] = time.split(':').map(Number);
  const total = (hours * 60 + currentMinutes + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export default function TodayScreen() {
  const { locale, languageTag, tx } = useI18n();
  const theme = useTheme();
  const { activeTrip, members, itineraryItems, loading, error, currentUserId, addItineraryItem } = useMvp();
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(activeTrip?.startsOn ?? new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:30');
  const [kind, setKind] = useState<ItineraryKind>('activity');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string>();

  const currentMember = members.find(({ userId }) => userId === currentUserId);
  const canEdit = currentMember?.role === 'owner' || currentMember?.role === 'editor';
  const upcomingItems = useMemo(() => itineraryItems, [itineraryItems]);

  async function submitItem() {
    setBusy(true);
    setFormError(undefined);
    try {
      const startsAt = new Date(`${date}T${startTime}:00`);
      const endsAt = new Date(`${date}T${endTime}:00`);
      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) throw new Error(tx('请选择有效的日期和时间。', 'Choose a valid date and time.'));
      if (endsAt <= startsAt) throw new Error(tx('结束时间需要晚于开始时间。', 'End time must be later than start time.'));
      await addItineraryItem({ title, locationLabel: location, kind, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() });
      setTitle('');
      setLocation('');
    } catch (caught) {
      setFormError(toUserMessage(caught, tx('无法添加行程安排，请稍后重试。', 'Could not add this plan. Please try again.')));
    } finally {
      setBusy(false);
    }
  }

  const kindLabel = (itemKind: ItineraryKind) => locale === 'zh-CN' ? itineraryKindLabels[itemKind] : itineraryKindLabelsEn[itemKind];

  return (
    <Screen
      meta={activeTrip ? `${activeTrip.startsOn} — ${activeTrip.endsOn}` : tx('今天', 'Today')}
      title={activeTrip?.name ?? tx('开始你的第一次行程', 'Start your first trip')}
      subtitle={activeTrip ? tx(`${members.length} 位同行者 · 本位币 ${activeTrip.homeCurrency}`, `${members.length} travellers · ${activeTrip.homeCurrency} home currency`) : tx('请先从“行程”页面创建或加入一个行程。', 'Create or join a trip from the Trips tab.') }>
      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
      {loading ? <InlineNotice>{tx('正在刷新共享时间线…', 'Refreshing the shared timeline…')}</InlineNotice> : null}

      {activeTrip ? (
        <View style={styles.summaryStrip}>
          <View style={styles.summaryItem}><ThemedText type="smallBold">{upcomingItems.length}</ThemedText><ThemedText type="small" themeColor="textSecondary">{tx('项安排', 'plans')}</ThemedText></View>
          <View style={[styles.summaryDivider, { backgroundColor: theme.backgroundSelected }]} />
          <View style={styles.summaryItem}><ThemedText type="smallBold">{members.length}</ThemedText><ThemedText type="small" themeColor="textSecondary">{tx('位同行者', 'travellers')}</ThemedText></View>
          <View style={[styles.summaryDivider, { backgroundColor: theme.backgroundSelected }]} />
          <View style={styles.summaryItem}><ThemedText type="smallBold">{activeTrip.homeCurrency}</ThemedText><ThemedText type="small" themeColor="textSecondary">{tx('旅行币种', 'currency')}</ThemedText></View>
        </View>
      ) : null}

      {!activeTrip ? (
        <InfoCard label={tx('暂无行程', 'No trip yet')} title={tx('创建或加入共享行程', 'Create or join a shared trip')}>
          <ThemedText themeColor="textSecondary">{tx('加入后，所有成员都可以在这里查看下一项已确认的安排。', 'Once joined, everyone can see the next confirmed plan here.')}</ThemedText>
        </InfoCard>
      ) : upcomingItems.length > 0 ? (
        <>
          <InfoCard label={tx('下一步', 'Up next')} title={upcomingItems[0].title} accent="#087F6A">
            <View style={styles.nextMeta}>
              <ThemedText type="smallBold">{formatDateTimeRange(upcomingItems[0].startsAt, upcomingItems[0].endsAt, languageTag)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{kindLabel(upcomingItems[0].kind)}</ThemedText>
            </View>
            {upcomingItems[0].locationLabel ? (
              <Pressable
                accessibilityRole="link"
                onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(upcomingItems[0].locationLabel ?? '')}`)}
                style={[styles.mapAction, { backgroundColor: theme.backgroundSelected }]}>
                <View style={styles.placeDot} />
                <View style={styles.placeCopy}>
                  <ThemedText type="smallBold">{upcomingItems[0].locationLabel}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{tx('在 Google 地图中打开', 'Open in Google Maps')} ›</ThemedText>
                </View>
              </Pressable>
            ) : null}
          </InfoCard>

          {upcomingItems.length > 1 ? (
            <View style={styles.timelineSection}>
              <ThemedText type="smallBold">{tx('接下来的安排', 'Later in the trip')}</ThemedText>
              {upcomingItems.slice(1).map((item) => (
                <View key={item.id} style={styles.timelineRow}>
                  <View style={[styles.timelineRail, { borderRightColor: theme.backgroundSelected }]}><View style={styles.timelineDot} /></View>
                  <View style={styles.timelineContent}>
                    <ThemedText type="small" themeColor="textSecondary">{formatDateTimeRange(item.startsAt, item.endsAt, languageTag)}</ThemedText>
                    <ThemedText type="smallBold">{item.title}</ThemedText>
                    {item.locationLabel ? <ThemedText type="small" themeColor="textSecondary">{item.locationLabel}</ThemedText> : null}
                  </View>
                  <ThemedText type="small" themeColor="textSecondary">{kindLabel(item.kind)}</ThemedText>
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
        <InfoCard label={tx('规划下一站', 'Plan the next stop')} title={tx('添加到共享时间线', 'Add to the shared timeline')} accent="#D86E35">
          <View style={styles.form}>
            <FormField label={tx('要做什么？', 'What are you doing?')} value={title} onChangeText={setTitle} placeholder={tx('例如：乘机场快线前往中环', 'For example: Airport Express to Central')} />
            <LocationField value={location} onChange={setLocation} />
            <View style={styles.row}>
              <View style={styles.dateField}><DateTimeField label={tx('日期', 'Date')} value={date} mode="date" onChange={setDate} /></View>
              <View style={styles.grow}><DateTimeField label={tx('开始', 'Starts')} value={startTime} mode="time" onChange={setStartTime} /></View>
              <View style={styles.grow}><DateTimeField label={tx('结束', 'Ends')} value={endTime} mode="time" onChange={setEndTime} /></View>
            </View>
            <View style={styles.durationRow}>
              <ThemedText type="small" themeColor="textSecondary">{tx('快速设置时长', 'Quick duration')}</ThemedText>
              {[30, 60, 120].map((minutes) => (
                <ChoiceChip key={minutes} selected={endTime === addMinutes(startTime, minutes)} onPress={() => setEndTime(addMinutes(startTime, minutes))}>
                  {minutes < 60 ? `${minutes}m` : `${minutes / 60}h`}
                </ChoiceChip>
              ))}
            </View>
            <View style={styles.chips}>
              {itineraryKinds.map((itemKind) => (
                <ChoiceChip key={itemKind} selected={kind === itemKind} onPress={() => setKind(itemKind)}>{kindLabel(itemKind)}</ChoiceChip>
              ))}
            </View>
            <ActionButton busy={busy} disabled={!title.trim()} onPress={submitItem}>{tx('加入时间线', 'Add to timeline')}</ActionButton>
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
  summaryStrip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8 },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  summaryDivider: { width: StyleSheet.hairlineWidth, height: 30 },
  nextMeta: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  mapAction: { minHeight: 52, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  placeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#087F6A' },
  placeCopy: { flex: 1 },
  timelineSection: { gap: 4, paddingTop: 8 },
  timelineRow: { minHeight: 76, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  timelineRail: { width: 16, alignItems: 'center', height: '100%', borderRightWidth: 1 },
  timelineDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#1B70A6', marginRight: -1, marginTop: 7 },
  timelineContent: { flex: 1, gap: 2, paddingBottom: 16 },
  durationRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
});
