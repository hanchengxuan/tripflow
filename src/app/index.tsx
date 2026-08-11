import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DateTimeField } from '@/components/date-time-field';
import { ActionButton, ChoiceChip, FormField, InlineNotice } from '@/components/form-controls';
import { InfoCard } from '@/components/info-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useMvp } from '@/features/mvp/mvp-provider';
import { toUserMessage } from '@/lib/user-error';
import type { ItineraryKind } from '@/domain/models';
import { itineraryKindLabels, itineraryKinds } from '@/constants/options';


export default function TodayScreen() {
  const { activeTrip, members, itineraryItems, loading, error, currentUserId, addItineraryItem } = useMvp();
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(activeTrip?.startsOn ?? new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('09:00');
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
      const startsAt = new Date(`${date}T${time}:00`);
      if (Number.isNaN(startsAt.getTime())) throw new Error('请选择有效的日期和时间。');
      await addItineraryItem({ title, locationLabel: location, kind, startsAt: startsAt.toISOString() });
      setTitle('');
      setLocation('');
    } catch (caught) {
      setFormError(toUserMessage(caught, '无法添加行程安排，请稍后重试。'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      eyebrow={activeTrip ? `${activeTrip.startsOn} 至 ${activeTrip.endsOn}` : '今天'}
      title={activeTrip?.name ?? '开始你的第一次行程'}
      subtitle={activeTrip ? `${members.length} 位同行者 · 本位币 ${activeTrip.homeCurrency}` : '请先从“行程”页面创建或加入一个行程。'}>
      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
      {loading ? <InlineNotice>正在刷新共享时间线…</InlineNotice> : null}

      {!activeTrip ? (
        <InfoCard label="暂无行程" title="创建或加入共享行程">
          <ThemedText themeColor="textSecondary">
            加入后，所有成员都可以在这里查看下一项已确认的安排。
          </ThemedText>
        </InfoCard>
      ) : upcomingItems.length > 0 ? (
        upcomingItems.map((item, index) => (
          <InfoCard
            key={item.id}
            label={index === 0 ? '下一步' : itineraryKindLabels[item.kind]}
            title={item.title}
            accent={index === 0 ? '#0F9D7A' : '#4B67D1'}>
            <ThemedText themeColor="textSecondary">
              {new Date(item.startsAt).toLocaleString('zh-CN')}
              {item.locationLabel ? ` · ${item.locationLabel}` : ''}
            </ThemedText>
          </InfoCard>
        ))
      ) : (
        <InfoCard label="时间线已就绪" title="还没有安排">
          <ThemedText themeColor="textSecondary">在下方添加第一项共享安排。</ThemedText>
        </InfoCard>
      )}

      {activeTrip && canEdit ? (
        <InfoCard label="快速添加" title="添加到共享时间线" accent="#E7863C">
          <View style={styles.form}>
            <FormField label="安排名称" value={title} onChangeText={setTitle} placeholder="例如：乘机场快线前往中环" />
            <FormField label="地点" value={location} onChangeText={setLocation} placeholder="例如：香港站" />
            <View style={styles.row}>
              <View style={styles.grow}><DateTimeField label="日期" value={date} mode="date" onChange={setDate} /></View>
              <View style={styles.grow}><DateTimeField label="时间" value={time} mode="time" onChange={setTime} /></View>
            </View>
            <View style={styles.chips}>
              {itineraryKinds.map((itemKind) => (
                <ChoiceChip key={itemKind} selected={kind === itemKind} onPress={() => setKind(itemKind)}>
                  {itineraryKindLabels[itemKind]}
                </ChoiceChip>
              ))}
            </View>
            <ActionButton busy={busy} disabled={!title.trim()} onPress={submitItem}>添加行程安排</ActionButton>
            {formError ? <InlineNotice tone="error">{formError}</InlineNotice> : null}
          </View>
        </InfoCard>
      ) : activeTrip ? (
        <InlineNotice>你当前是仅查看成员，可以查看共享时间线，但不能编辑。</InlineNotice>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  grow: { flexGrow: 1, flexBasis: 180 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
