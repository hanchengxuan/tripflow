import { useMemo, useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, View } from 'react-native';

import { DateTimeField } from '@/components/date-time-field';
import { ActionButton, ChoiceChip, FormField, InlineNotice } from '@/components/form-controls';
import { Screen } from '@/components/screen';
import { SelectionField } from '@/components/selection-field';
import { ThemedText } from '@/components/themed-text';
import { getCurrencyOptions, getTimeZoneOptions, tripRoleLabels, tripRoleLabelsEn } from '@/constants/options';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useMvp } from '@/features/mvp/mvp-provider';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/user-error';

type OpenPanel = 'create' | 'join' | null;

function dateOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export default function TripsScreen() {
  const theme = useTheme();
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
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
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
      ? tx(`${activeTrip.startsOn} 至 ${activeTrip.endsOn} · ${activeTrip.homeCurrency}`, `${activeTrip.startsOn} to ${activeTrip.endsOn} · ${activeTrip.homeCurrency}`)
      : tx('先创建一个旅行空间，之后随时邀请同行者。', 'Create your first trip, then invite travellers anytime.'),
    [activeTrip, tx],
  );
  const currencyOptions = getCurrencyOptions(locale === 'en');
  const timeZoneOptions = getTimeZoneOptions(locale === 'en');

  function togglePanel(panel: Exclude<OpenPanel, null>) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenPanel((current) => current === panel ? null : panel);
    setActionError(undefined);
    setSuccess(undefined);
  }

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
      setOpenPanel(null);
    }, tx('新行程已创建。', 'Trip created.'));
  }

  async function submitInvite() {
    await run('join', async () => {
      await joinTrip(inviteCode);
      setInviteCode('');
      setOpenPanel(null);
    }, tx('已加入行程。', 'You joined the trip.'));
  }

  async function generateInvite() {
    await run('invite', async () => {
      setGeneratedInvite(await createInvite(inviteRole));
    });
  }

  return (
    <Screen title={tx('行程', 'Trips')} subtitle={tx('选择当前旅程，管理同行者与共享空间。', 'Choose your current trip and manage the people travelling with you.') }>
      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
      {actionError ? <InlineNotice tone="error">{actionError}</InlineNotice> : null}
      {success ? <InlineNotice>{success}</InlineNotice> : null}
      {loading ? <InlineNotice>{tx('正在同步行程…', 'Syncing trips…')}</InlineNotice> : null}

      <View style={[styles.tripHero, { backgroundColor: theme.backgroundElement }] }>
        <View style={styles.heroTop}>
          <View style={styles.heroCopy}>
            <ThemedText type="smallBold" themeColor="textSecondary">{tx('当前行程', 'Current trip')}</ThemedText>
            <ThemedText type="subtitle" style={styles.tripName}>{activeTrip?.name ?? tx('还没有行程', 'No trip yet')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{tripSummary}</ThemedText>
          </View>
          {activeTrip ? (
            <View style={[styles.memberCount, { backgroundColor: theme.backgroundSelected }] }>
              <ThemedText type="smallBold">{tx(`${members.length} 人`, `${members.length} people`)}</ThemedText>
            </View>
          ) : null}
        </View>
        <View style={styles.quickActions}>
          <View style={styles.actionGrow}>
            <ActionButton onPress={() => togglePanel('create')}>{openPanel === 'create' ? tx('收起', 'Close') : tx('新建行程', 'New trip')}</ActionButton>
          </View>
          <View style={styles.actionGrow}>
            <ActionButton tone="secondary" onPress={() => togglePanel('join')}>{openPanel === 'join' ? tx('收起', 'Close') : tx('使用邀请码', 'Use invite')}</ActionButton>
          </View>
        </View>
      </View>

      {openPanel === 'create' ? (
        <View style={[styles.focusPanel, { backgroundColor: theme.backgroundElement }] }>
          <View style={styles.panelHeader}>
            <ThemedText type="smallBold" style={styles.panelTitle}>{tx('创建新行程', 'Create a new trip')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{tx('先设置基本信息，详细安排可以稍后添加。', 'Start with the basics. Add the detailed plan later.')}</ThemedText>
          </View>
          <FormField label={tx('行程名称', 'Trip name')} value={name} onChangeText={setName} placeholder={tx('例如：北海道滑雪之旅', 'For example: Hokkaido ski trip')} />
          <View style={styles.formRow}>
            <View style={styles.fieldGrow}><DateTimeField label={tx('开始日期', 'Start date')} value={startsOn} mode="date" onChange={setStartsOn} /></View>
            <View style={styles.fieldGrow}>
              <DateTimeField label={tx('结束日期', 'End date')} value={endsOn} mode="date" minimumDate={new Date(`${startsOn}T12:00:00`)} onChange={setEndsOn} />
            </View>
          </View>
          <View style={styles.formRow}>
            <View style={styles.fieldGrow}><SelectionField label={tx('记账币种', 'Home currency')} value={currency} options={currencyOptions} onChange={setCurrency} /></View>
            <View style={styles.fieldGrow}><SelectionField label={tx('行程时区', 'Time zone')} value={timeZone} options={timeZoneOptions} onChange={setTimeZone} /></View>
          </View>
          <ActionButton busy={busyAction === 'create'} disabled={!name.trim()} onPress={() => void submitTrip()}>{tx('创建并进入行程', 'Create and open trip')}</ActionButton>
        </View>
      ) : null}

      {openPanel === 'join' ? (
        <View style={[styles.focusPanel, { backgroundColor: theme.backgroundElement }] }>
          <View style={styles.panelHeader}>
            <ThemedText type="smallBold" style={styles.panelTitle}>{tx('加入同行者的行程', 'Join a shared trip')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{tx('粘贴同行者发给你的 48 位邀请码。', 'Paste the 48-character code a traveller shared with you.')}</ThemedText>
          </View>
          <FormField label={tx('邀请码', 'Invite code')} value={inviteCode} onChangeText={setInviteCode} autoCapitalize="none" autoCorrect={false} placeholder={tx('粘贴邀请码', 'Paste invite code')} />
          <ActionButton busy={busyAction === 'join'} disabled={inviteCode.trim().length !== 48} onPress={() => void submitInvite()}>{tx('确认加入', 'Join trip')}</ActionButton>
        </View>
      ) : null}

      {trips.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>{tx('我的行程', 'My trips')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{tx(`${trips.length} 个`, `${trips.length} total`)}</ThemedText>
          </View>
          <View style={styles.tripList}>
            {trips.map((trip, index) => {
              const selected = trip.id === activeTrip?.id;
              return (
                <View key={trip.id}>
                  {index > 0 ? <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} /> : null}
                  <Pressable accessibilityRole="button" onPress={() => void selectTrip(trip.id)} style={styles.tripRow}>
                    <View style={styles.tripRowCopy}>
                      <ThemedText type="smallBold">{trip.name}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">{trip.startsOn} — {trip.endsOn}</ThemedText>
                    </View>
                    <ThemedText type="smallBold" style={selected ? styles.selectedText : undefined} themeColor={selected ? undefined : 'textSecondary'}>
                      {selected ? tx('当前', 'Current') : tx('切换', 'Open')}
                    </ThemedText>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {activeTrip ? (
        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View style={styles.sectionHeadingCopy}>
              <ThemedText type="smallBold" style={styles.sectionTitle}>{tx('同行者', 'Travellers')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{tx('共同查看和编辑这次旅程的人。', 'People sharing this trip.')}</ThemedText>
            </View>
          </View>
          <View style={styles.memberList}>
            {members.map((member, index) => (
              <View key={member.userId}>
                {index > 0 ? <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} /> : null}
                <View style={styles.memberRow}>
                  <View style={[styles.memberAvatar, { backgroundColor: theme.backgroundSelected }]}>
                    <ThemedText type="smallBold" style={styles.memberInitials}>{member.displayName.trim().slice(0, 2).toUpperCase()}</ThemedText>
                  </View>
                  <ThemedText style={styles.memberName}>{member.displayName}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{locale === 'zh-CN' ? tripRoleLabels[member.role] : tripRoleLabelsEn[member.role]}</ThemedText>
                </View>
              </View>
            ))}
          </View>

          {isOwner ? (
            <View style={[styles.inviteArea, { borderTopColor: theme.backgroundSelected }] }>
              <View style={styles.inviteCopy}>
                <ThemedText type="smallBold">{tx('邀请同行者', 'Invite travellers')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{tx('选择权限后生成一枚可分享的邀请码。', 'Choose access, then create a shareable code.')}</ThemedText>
              </View>
              <View style={styles.roleRow}>
                <ChoiceChip selected={inviteRole === 'editor'} onPress={() => setInviteRole('editor')}>{tx('可编辑', 'Can edit')}</ChoiceChip>
                <ChoiceChip selected={inviteRole === 'viewer'} onPress={() => setInviteRole('viewer')}>{tx('仅查看', 'View only')}</ChoiceChip>
              </View>
              <ActionButton tone="secondary" busy={busyAction === 'invite'} onPress={() => void generateInvite()}>{tx('生成邀请码', 'Create invite code')}</ActionButton>
              {generatedInvite ? (
                <InlineNotice>{tx('邀请码', 'Invite code')}：{generatedInvite.token}{'\n'}{tx('有效期至', 'Expires')}：{formatDateTime(generatedInvite.expiresAt)}</InlineNotice>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tripHero: { borderRadius: 16, padding: 20, gap: 20, shadowColor: '#17324D', shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  heroCopy: { flex: 1, gap: 4 },
  tripName: { fontSize: 28, lineHeight: 36 },
  memberCount: { minHeight: 36, borderRadius: 999, paddingHorizontal: 12, justifyContent: 'center' },
  quickActions: { flexDirection: 'row', gap: 10 },
  actionGrow: { flex: 1 },
  focusPanel: { borderRadius: 16, padding: 18, gap: 14, shadowColor: '#17324D', shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 7 } },
  panelHeader: { gap: 3, marginBottom: 2 },
  panelTitle: { fontSize: 20, lineHeight: 26 },
  formRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  fieldGrow: { flexGrow: 1, flexBasis: 220 },
  section: { paddingTop: 20, gap: 12 },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 },
  sectionHeadingCopy: { flex: 1, gap: 2 },
  sectionTitle: { fontSize: 20, lineHeight: 26 },
  tripList: { gap: 0 },
  tripRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 8 },
  tripRowCopy: { flex: 1, gap: 2 },
  selectedText: { color: '#087F6A' },
  divider: { height: StyleSheet.hairlineWidth },
  memberList: { gap: 0 },
  memberRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12 },
  memberAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  memberInitials: { color: '#087F6A' },
  memberName: { flex: 1 },
  inviteArea: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 18, marginTop: 6, gap: 12 },
  inviteCopy: { gap: 2 },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
