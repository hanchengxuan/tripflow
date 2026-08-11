import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DateTimeField } from '@/components/date-time-field';
import { ActionButton, ChoiceChip, FormField, InlineNotice } from '@/components/form-controls';
import { InfoCard } from '@/components/info-card';
import { Screen } from '@/components/screen';
import { SelectionField } from '@/components/selection-field';
import { ThemedText } from '@/components/themed-text';
import { getCurrencyOptions, getTimeZoneOptions, tripRoleLabels, tripRoleLabelsEn } from '@/constants/options';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useMvp } from '@/features/mvp/mvp-provider';
import { toUserMessage } from '@/lib/user-error';

function dateOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export default function TripsScreen() {
  const { locale, formatDateTime, tx } = useI18n();
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
      ? tx(`${activeTrip.startsOn} 至 ${activeTrip.endsOn} · 记账本位币 ${activeTrip.homeCurrency}`, `${activeTrip.startsOn} to ${activeTrip.endsOn} · ${activeTrip.homeCurrency} home currency`)
      : tx('创建新行程，或输入邀请码加入同行者的行程。', 'Create a trip or join your group with an invite code.'),
    [activeTrip, tx],
  );
  const currencyOptions = getCurrencyOptions(locale === 'en');
  const timeZoneOptions = getTimeZoneOptions(locale === 'en');

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
    }, tx('行程创建成功，你是该行程的创建者。', 'Trip created. You are its owner.'));
  }

  async function submitInvite() {
    await run('join', async () => {
      await joinTrip(inviteCode);
      setInviteCode('');
    }, tx('已接受邀请，欢迎加入行程。', 'Invite accepted. Welcome to the trip.'));
  }

  async function generateInvite() {
    await run('invite', async () => {
      setGeneratedInvite(await createInvite(inviteRole));
    });
  }

  return (
    <Screen meta={tx('行程与成员', 'Trips and people')} title={activeTrip?.name ?? tx('我的行程', 'My trips')} subtitle={tripSummary}>
      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
      {actionError ? <InlineNotice tone="error">{actionError}</InlineNotice> : null}
      {success ? <InlineNotice>{success}</InlineNotice> : null}
      {loading ? <InlineNotice>{tx('正在同步行程与成员…', 'Syncing trips and travellers…')}</InlineNotice> : null}

      {trips.length > 0 ? (
        <InfoCard label={tx('当前行程', 'Current trip')} title={tx('切换行程', 'Switch trip')}>
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
        <InfoCard label={tx('同行成员', 'Travellers')} title={tx(`共 ${members.length} 人`, `${members.length} people`)}>
          <View style={styles.memberList}>
            {members.map((member) => (
              <View key={member.userId} style={styles.memberRow}>
                <ThemedText>{member.displayName}</ThemedText>
                <ThemedText type="smallBold" themeColor="textSecondary">{locale === 'zh-CN' ? tripRoleLabels[member.role] : tripRoleLabelsEn[member.role]}</ThemedText>
              </View>
            ))}
          </View>
          <ThemedText type="small" themeColor="textSecondary">{tx('个人名称与账号信息可在“我的”页面编辑。', 'Edit your name and account details from Me.')}</ThemedText>
        </InfoCard>
      ) : null}

      {activeTrip && isOwner ? (
        <InfoCard label={tx('邀请成员', 'Invite travellers')} title={tx('一分钟内加入同行者', 'Bring your group in quickly')} accent="#1B70A6">
          <View style={styles.form}>
            <View style={styles.chips}>
              <ChoiceChip selected={inviteRole === 'editor'} onPress={() => setInviteRole('editor')}>{tx('可编辑', 'Can edit')}</ChoiceChip>
              <ChoiceChip selected={inviteRole === 'viewer'} onPress={() => setInviteRole('viewer')}>{tx('仅查看', 'View only')}</ChoiceChip>
            </View>
            <ActionButton busy={busyAction === 'invite'} onPress={() => void generateInvite()}>{tx('生成邀请码', 'Create invite code')}</ActionButton>
            {generatedInvite ? (
              <InlineNotice>
                {tx('邀请码', 'Invite code')}：{generatedInvite.token}{'\n'}{tx('有效期至', 'Expires')}：{formatDateTime(generatedInvite.expiresAt)}
              </InlineNotice>
            ) : null}
          </View>
        </InfoCard>
      ) : null}

      <InfoCard label={tx('加入行程', 'Join a trip')} title={tx('输入 TripFlow 邀请码', 'Enter a TripFlow invite code')} accent="#D86E35">
        <View style={styles.form}>
          <FormField
            label={tx('邀请码', 'Invite code')}
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="none"
            placeholder={tx('48 位邀请码', '48-character invite code')}
          />
          <ActionButton busy={busyAction === 'join'} disabled={inviteCode.trim().length !== 48} onPress={() => void submitInvite()}>
            {tx('加入行程', 'Join trip')}
          </ActionButton>
        </View>
      </InfoCard>

      <InfoCard label={tx('新行程', 'New trip')} title={tx('创建共享旅行空间', 'Create a shared travel space')}>
        <View style={styles.form}>
          <FormField label={tx('行程名称', 'Trip name')} value={name} onChangeText={setName} placeholder={tx('例如：2026 年末亚洲之旅', 'For example: Asia at the end of 2026')} />
          <View style={styles.row}>
            <View style={styles.grow}><DateTimeField label={tx('开始日期', 'Start date')} value={startsOn} mode="date" onChange={setStartsOn} /></View>
            <View style={styles.grow}>
              <DateTimeField
                label={tx('结束日期', 'End date')}
                value={endsOn}
                mode="date"
                minimumDate={new Date(`${startsOn}T12:00:00`)}
                onChange={setEndsOn}
              />
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.grow}>
              <SelectionField label={tx('记账本位币', 'Home currency')} value={currency} options={currencyOptions} onChange={setCurrency} />
            </View>
            <View style={styles.grow}>
              <SelectionField label={tx('行程时区', 'Trip time zone')} value={timeZone} options={timeZoneOptions} onChange={setTimeZone} />
            </View>
          </View>
          <ActionButton busy={busyAction === 'create'} disabled={!name.trim()} onPress={() => void submitTrip()}>{tx('创建行程', 'Create trip')}</ActionButton>
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
