import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DateTimeField } from '@/components/date-time-field';
import { ActionButton, ChoiceChip, FormField, InlineNotice } from '@/components/form-controls';
import { InfoCard } from '@/components/info-card';
import { Screen } from '@/components/screen';
import { SelectionField } from '@/components/selection-field';
import { ThemedText } from '@/components/themed-text';
import { currencyOptions, timeZoneOptions, tripRoleLabels } from '@/constants/options';
import { useMvp } from '@/features/mvp/mvp-provider';
import { toUserMessage } from '@/lib/user-error';

function dateOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export default function TripsScreen() {
  const {
    trips,
    activeTrip,
    members,
    currentUserId,
    loading,
    error,
    selectTrip,
    createTrip,
    joinTrip,
    createInvite,
  } = useMvp();
  const currentMember = members.find(({ userId }) => userId === currentUserId);
  const isOwner = currentMember?.role === 'owner';
  const [name, setName] = useState('');
  const [startsOn, setStartsOn] = useState(dateOffset(30));
  const [endsOn, setEndsOn] = useState(dateOffset(37));
  const [currency, setCurrency] = useState('HKD');
  const [timeZone, setTimeZone] = useState('Asia/Hong_Kong');
  const [inviteCode, setInviteCode] = useState('');
  const [generatedInvite, setGeneratedInvite] = useState<{ token: string; expiresAt: string }>();
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [busyAction, setBusyAction] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const [success, setSuccess] = useState<string>();

  const tripSummary = useMemo(
    () => activeTrip
      ? `${activeTrip.startsOn} 至 ${activeTrip.endsOn} · 记账本位币 ${activeTrip.homeCurrency}`
      : '创建新行程，或输入邀请码加入同行者的行程。',
    [activeTrip],
  );

  async function run(action: string, work: () => Promise<void>, successMessage?: string) {
    setBusyAction(action);
    setActionError(undefined);
    setSuccess(undefined);
    try {
      await work();
      if (successMessage) setSuccess(successMessage);
    } catch (caught) {
      setActionError(toUserMessage(caught));
    } finally {
      setBusyAction(undefined);
    }
  }

  async function submitTrip() {
    await run('create', async () => {
      await createTrip({ name, startsOn, endsOn, homeCurrency: currency, defaultTimeZone: timeZone });
      setName('');
    }, '行程创建成功，你是该行程的创建者。');
  }

  async function submitInvite() {
    await run('join', async () => {
      await joinTrip(inviteCode);
      setInviteCode('');
    }, '已接受邀请，欢迎加入行程。');
  }

  async function generateInvite() {
    await run('invite', async () => {
      setGeneratedInvite(await createInvite(inviteRole));
    });
  }

  return (
    <Screen eyebrow="行程与成员" title={activeTrip?.name ?? '我的行程'} subtitle={tripSummary}>
      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
      {actionError ? <InlineNotice tone="error">{actionError}</InlineNotice> : null}
      {success ? <InlineNotice>{success}</InlineNotice> : null}
      {loading ? <InlineNotice>正在同步行程与成员…</InlineNotice> : null}

      {trips.length > 0 ? (
        <InfoCard label="当前行程" title="切换行程">
          <View style={styles.chips}>
            {trips.map((trip) => (
              <ChoiceChip key={trip.id} selected={trip.id === activeTrip?.id} onPress={() => void selectTrip(trip.id)}>
                {trip.name}
              </ChoiceChip>
            ))}
          </View>
        </InfoCard>
      ) : null}

      {activeTrip ? (
        <InfoCard label="同行成员" title={`共 ${members.length} 人`}>
          <View style={styles.memberList}>
            {members.map((member) => (
              <View key={member.userId} style={styles.memberRow}>
                <ThemedText>{member.displayName}</ThemedText>
                <ThemedText type="smallBold" themeColor="textSecondary">{tripRoleLabels[member.role]}</ThemedText>
              </View>
            ))}
          </View>
          <ThemedText type="small" themeColor="textSecondary">个人名称与账号信息可在“我的”页面编辑。</ThemedText>
        </InfoCard>
      ) : null}

      {activeTrip && isOwner ? (
        <InfoCard label="邀请成员" title="一分钟内加入同行者" accent="#4B67D1">
          <View style={styles.form}>
            <View style={styles.chips}>
              <ChoiceChip selected={inviteRole === 'editor'} onPress={() => setInviteRole('editor')}>可编辑</ChoiceChip>
              <ChoiceChip selected={inviteRole === 'viewer'} onPress={() => setInviteRole('viewer')}>仅查看</ChoiceChip>
            </View>
            <ActionButton busy={busyAction === 'invite'} onPress={() => void generateInvite()}>生成邀请码</ActionButton>
            {generatedInvite ? (
              <InlineNotice>
                邀请码：{generatedInvite.token}{'\n'}有效期至：{new Date(generatedInvite.expiresAt).toLocaleString('zh-CN')}
              </InlineNotice>
            ) : null}
          </View>
        </InfoCard>
      ) : null}

      <InfoCard label="加入行程" title="输入 TripFlow 邀请码" accent="#E7863C">
        <View style={styles.form}>
          <FormField
            label="邀请码"
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="none"
            placeholder="48 位邀请码"
          />
          <ActionButton busy={busyAction === 'join'} disabled={inviteCode.trim().length !== 48} onPress={() => void submitInvite()}>
            加入行程
          </ActionButton>
        </View>
      </InfoCard>

      <InfoCard label="新行程" title="创建共享旅行空间">
        <View style={styles.form}>
          <FormField label="行程名称" value={name} onChangeText={setName} placeholder="例如：2026 年末亚洲之旅" />
          <View style={styles.row}>
            <View style={styles.grow}><DateTimeField label="开始日期" value={startsOn} mode="date" onChange={setStartsOn} /></View>
            <View style={styles.grow}>
              <DateTimeField
                label="结束日期"
                value={endsOn}
                mode="date"
                minimumDate={new Date(`${startsOn}T12:00:00`)}
                onChange={setEndsOn}
              />
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.grow}>
              <SelectionField label="记账本位币" value={currency} options={currencyOptions} onChange={setCurrency} />
            </View>
            <View style={styles.grow}>
              <SelectionField label="行程时区" value={timeZone} options={timeZoneOptions} onChange={setTimeZone} />
            </View>
          </View>
          <ActionButton busy={busyAction === 'create'} disabled={!name.trim()} onPress={() => void submitTrip()}>创建行程</ActionButton>
        </View>
      </InfoCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  grow: { flexGrow: 1, flexBasis: 180 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  memberList: { gap: 8 },
  memberRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
});
