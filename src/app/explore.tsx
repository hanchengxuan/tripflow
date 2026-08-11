import { useMemo, useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, View } from 'react-native';

import { DateTimeField } from '@/components/date-time-field';
import { ActionButton, ChoiceChip, FormField, InlineNotice } from '@/components/form-controls';
import { MemberAvatar } from '@/components/member-avatar';
import { Screen } from '@/components/screen';
import { SelectionField } from '@/components/selection-field';
import { ThemedText } from '@/components/themed-text';
import { getCurrencyOptions, getTimeZoneOptions, tripRoleLabels, tripRoleLabelsEn } from '@/constants/options';
import type { Trip, TripRole } from '@/domain/models';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useMvp } from '@/features/mvp/mvp-provider';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/user-error';

type OpenPanel = 'create' | 'join' | 'manage' | null;

function dateOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export default function TripsScreen() {
  const theme = useTheme();
  const { locale, formatDateTime, tx } = useI18n();
  const {
    trips, activeTrip, members, currentUserId, loading, error,
    selectTrip, createTrip, joinTrip, createInvite, saveTrip, deleteTrip, setMemberRole, removeMember,
  } = useMvp();
  const currentMember = members.find(({ userId }) => userId === currentUserId);
  const canEditTrip = currentMember?.role === 'owner' || currentMember?.role === 'editor';
  const isOwner = currentMember?.role === 'owner';
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const [name, setName] = useState('');
  const [startsOn, setStartsOn] = useState(dateOffset(30));
  const [endsOn, setEndsOn] = useState(dateOffset(37));
  const [currency, setCurrency] = useState('HKD');
  const [timeZone, setTimeZone] = useState('Asia/Hong_Kong');
  const [editName, setEditName] = useState('');
  const [editStartsOn, setEditStartsOn] = useState('');
  const [editEndsOn, setEditEndsOn] = useState('');
  const [editCurrency, setEditCurrency] = useState('HKD');
  const [editTimeZone, setEditTimeZone] = useState('Asia/Hong_Kong');
  const [editingTrip, setEditingTrip] = useState(false);
  const [confirmDeleteTrip, setConfirmDeleteTrip] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string>();
  const [confirmRemoveId, setConfirmRemoveId] = useState<string>();
  const [inviteCode, setInviteCode] = useState('');
  const [generatedInvite, setGeneratedInvite] = useState<{ token: string; expiresAt: string }>();
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [busyAction, setBusyAction] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const [success, setSuccess] = useState<string>();

  const tripSummary = useMemo(() => activeTrip
    ? tx(`${activeTrip.startsOn} 至 ${activeTrip.endsOn} · ${activeTrip.homeCurrency}`, `${activeTrip.startsOn} to ${activeTrip.endsOn} · ${activeTrip.homeCurrency}`)
    : tx('先创建一个旅行空间，之后随时邀请同行者。', 'Create your first trip, then invite travellers anytime.'), [activeTrip, tx]);
  const currencyOptions = getCurrencyOptions(locale === 'en');
  const timeZoneOptions = getTimeZoneOptions(locale === 'en');

  function prepareEdit(trip: Trip) {
    setEditName(trip.name);
    setEditStartsOn(trip.startsOn);
    setEditEndsOn(trip.endsOn);
    setEditCurrency(trip.homeCurrency);
    setEditTimeZone(trip.defaultTimeZone);
  }

  function showPanel(panel: Exclude<OpenPanel, null>) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenPanel((current) => current === panel ? null : panel);
    setEditingTrip(false);
    setConfirmDeleteTrip(false);
    setEditingMemberId(undefined);
    setConfirmRemoveId(undefined);
    setGeneratedInvite(undefined);
    setActionError(undefined);
    setSuccess(undefined);
  }

  async function openTrip(trip: Trip) {
    setOpenPanel('manage');
    setEditingTrip(false);
    setConfirmDeleteTrip(false);
    setEditingMemberId(undefined);
    setConfirmRemoveId(undefined);
    setGeneratedInvite(undefined);
    setActionError(undefined);
    setSuccess(undefined);
    if (trip.id !== activeTrip?.id) await selectTrip(trip.id);
    prepareEdit(trip);
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

  async function submitTripEdit() {
    await run('edit-trip', async () => {
      await saveTrip({ name: editName, startsOn: editStartsOn, endsOn: editEndsOn, homeCurrency: editCurrency, defaultTimeZone: editTimeZone });
      setEditingTrip(false);
    }, tx('行程资料已更新。', 'Trip details updated.'));
  }

  async function permanentlyDeleteTrip() {
    await run('delete-trip', async () => {
      await deleteTrip();
      setConfirmDeleteTrip(false);
      setOpenPanel(null);
    }, tx('行程及其安排已永久删除。', 'Trip and its plans were permanently deleted.'));
  }

  async function submitInvite() {
    await run('join', async () => {
      await joinTrip(inviteCode);
      setInviteCode('');
      setOpenPanel(null);
    }, tx('已加入行程。', 'You joined the trip.'));
  }

  async function generateInvite() {
    await run('invite', async () => setGeneratedInvite(await createInvite(inviteRole)));
  }

  async function changeRole(userId: string, role: TripRole) {
    await run(`role-${userId}`, async () => {
      await setMemberRole(userId, role);
      setEditingMemberId(undefined);
    }, tx('同行者权限已更新。', 'Traveller access updated.'));
  }

  async function confirmRemove(userId: string) {
    await run(`remove-${userId}`, async () => {
      await removeMember(userId);
      setEditingMemberId(undefined);
      setConfirmRemoveId(undefined);
    }, tx('同行者已移出此行程。', 'Traveller removed from this trip.'));
  }

  return (
    <Screen title={tx('行程', 'Trips')} subtitle={tx('打开一段旅程，编辑资料并管理同行者。', 'Open a trip to edit its details and manage travellers.')}>
      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
      {actionError ? <InlineNotice tone="error">{actionError}</InlineNotice> : null}
      {success ? <InlineNotice>{success}</InlineNotice> : null}
      {loading ? <InlineNotice>{tx('正在同步行程…', 'Syncing trips…')}</InlineNotice> : null}

      <View style={[styles.tripHero, { backgroundColor: theme.backgroundElement }]}>
        <View style={styles.heroTop}>
          <View style={styles.heroCopy}>
            <ThemedText type="smallBold" themeColor="textSecondary">{tx('当前行程', 'Current trip')}</ThemedText>
            <ThemedText type="subtitle" style={styles.tripName}>{activeTrip?.name ?? tx('还没有行程', 'No trip yet')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{tripSummary}</ThemedText>
          </View>
          {activeTrip ? <View style={[styles.memberCount, { backgroundColor: theme.backgroundSelected }]}><ThemedText type="smallBold">{tx(`${members.length} 人`, `${members.length} people`)}</ThemedText></View> : null}
        </View>
        <View style={styles.quickActions}>
          {activeTrip ? <View style={styles.actionGrow}><ActionButton onPress={() => void openTrip(activeTrip)}>{tx('打开当前行程', 'Open current trip')}</ActionButton></View> : null}
          <View style={styles.actionGrow}><ActionButton tone={activeTrip ? 'secondary' : 'primary'} onPress={() => showPanel('create')}>{openPanel === 'create' ? tx('收起', 'Close') : tx('新建行程', 'New trip')}</ActionButton></View>
          <View style={styles.actionGrow}><ActionButton tone="secondary" onPress={() => showPanel('join')}>{openPanel === 'join' ? tx('收起', 'Close') : tx('使用邀请码', 'Use invite')}</ActionButton></View>
        </View>
      </View>

      {openPanel === 'create' ? (
        <View style={[styles.focusPanel, { backgroundColor: theme.backgroundElement }]}>
          <PanelHeading title={tx('创建新行程', 'Create a new trip')} caption={tx('先设置基本信息，详细安排可以稍后添加。', 'Start with the basics. Add the detailed plan later.')} />
          <TripForm name={name} setName={setName} startsOn={startsOn} setStartsOn={setStartsOn} endsOn={endsOn} setEndsOn={setEndsOn} currency={currency} setCurrency={setCurrency} timeZone={timeZone} setTimeZone={setTimeZone} currencyOptions={currencyOptions} timeZoneOptions={timeZoneOptions} tx={tx} />
          <ActionButton busy={busyAction === 'create'} disabled={!name.trim()} onPress={() => void submitTrip()}>{tx('创建并进入行程', 'Create and open trip')}</ActionButton>
        </View>
      ) : null}

      {openPanel === 'join' ? (
        <View style={[styles.focusPanel, { backgroundColor: theme.backgroundElement }]}>
          <PanelHeading title={tx('加入同行者的行程', 'Join a shared trip')} caption={tx('粘贴同行者发给你的 48 位邀请码。', 'Paste the 48-character code a traveller shared with you.')} />
          <FormField label={tx('邀请码', 'Invite code')} value={inviteCode} onChangeText={setInviteCode} autoCapitalize="none" autoCorrect={false} placeholder={tx('粘贴邀请码', 'Paste invite code')} />
          <ActionButton busy={busyAction === 'join'} disabled={inviteCode.trim().length !== 48} onPress={() => void submitInvite()}>{tx('确认加入', 'Join trip')}</ActionButton>
        </View>
      ) : null}

      {openPanel === 'manage' && activeTrip ? (
        <View style={[styles.focusPanel, { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.manageHeader}>
            <PanelHeading title={activeTrip.name} caption={tx('行程资料与同行者', 'Trip details and travellers')} />
            <Pressable accessibilityRole="button" onPress={() => setOpenPanel(null)} style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}><ThemedText type="smallBold" themeColor="textSecondary">{tx('关闭', 'Close')}</ThemedText></Pressable>
          </View>

          {editingTrip ? (
            <View style={styles.editorBlock}>
              <TripForm name={editName} setName={setEditName} startsOn={editStartsOn} setStartsOn={setEditStartsOn} endsOn={editEndsOn} setEndsOn={setEditEndsOn} currency={editCurrency} setCurrency={setEditCurrency} timeZone={editTimeZone} setTimeZone={setEditTimeZone} currencyOptions={currencyOptions} timeZoneOptions={timeZoneOptions} tx={tx} />
              <View style={styles.editorActions}>
                <View style={styles.actionGrow}><ActionButton tone="secondary" onPress={() => { prepareEdit(activeTrip); setEditingTrip(false); }}>{tx('取消', 'Cancel')}</ActionButton></View>
                <View style={styles.actionGrow}><ActionButton busy={busyAction === 'edit-trip'} disabled={!editName.trim()} onPress={() => void submitTripEdit()}>{tx('保存行程', 'Save trip')}</ActionButton></View>
              </View>
            </View>
          ) : (
            <View style={styles.detailsBlock}>
              <Detail label={tx('日期', 'Dates')} value={`${activeTrip.startsOn} — ${activeTrip.endsOn}`} />
              <Detail label={tx('记账币种', 'Home currency')} value={activeTrip.homeCurrency} />
              <Detail label={tx('时区', 'Time zone')} value={activeTrip.defaultTimeZone} />
              <Detail label={tx('我的权限', 'My access')} value={currentMember ? (locale === 'zh-CN' ? tripRoleLabels[currentMember.role] : tripRoleLabelsEn[currentMember.role]) : '—'} />
              {canEditTrip ? <View style={styles.editorActions}><View style={styles.actionGrow}><ActionButton tone="secondary" onPress={() => { prepareEdit(activeTrip); setEditingTrip(true); setConfirmDeleteTrip(false); }}>{tx('编辑行程资料', 'Edit trip details')}</ActionButton></View>{activeTrip.createdBy === currentUserId ? <View style={styles.actionGrow}><Pressable accessibilityRole="button" onPress={() => setConfirmDeleteTrip(true)} style={({ pressed }) => [styles.dangerAction, { borderColor: theme.backgroundSelected }, pressed && styles.pressed]}><ThemedText type="smallBold" style={{ color: theme.danger }}>{tx('删除行程', 'Delete trip')}</ThemedText></Pressable></View> : null}</View> : null}
            </View>
          )}

          {confirmDeleteTrip ? (
            <View style={[styles.dangerZone, { borderTopColor: theme.backgroundSelected }]}>
              <PanelHeading title={tx('永久删除这个行程？', 'Permanently delete this trip?')} caption={tx('所有安排、分账、转账记录和收据都会删除，且无法恢复。只有创建者可以执行。', 'All plans, expenses, transfers, and receipts will be deleted and cannot be recovered. Only the creator can do this.')} />
              <View style={styles.editorActions}>
                <View style={styles.actionGrow}><ActionButton tone="secondary" onPress={() => setConfirmDeleteTrip(false)}>{tx('保留行程', 'Keep trip')}</ActionButton></View>
                <View style={styles.actionGrow}><Pressable accessibilityRole="button" disabled={busyAction === 'delete-trip'} onPress={() => void permanentlyDeleteTrip()} style={({ pressed }) => [styles.dangerConfirm, pressed && styles.pressed, busyAction === 'delete-trip' && styles.disabled]}><ThemedText type="smallBold" style={styles.dangerConfirmText}>{busyAction === 'delete-trip' ? tx('删除中…', 'Deleting…') : tx('确认永久删除', 'Delete permanently')}</ThemedText></Pressable></View>
              </View>
            </View>
          ) : null}

          <View style={[styles.travellersBlock, { borderTopColor: theme.backgroundSelected }]}>
            <View style={styles.sectionHeading}>
              <View style={styles.sectionHeadingCopy}><ThemedText type="smallBold" style={styles.sectionTitle}>{tx('同行者', 'Travellers')}</ThemedText><ThemedText type="small" themeColor="textSecondary">{isOwner ? tx('点击成员可调整权限或移出行程。', 'Open a traveller to change access or remove them.') : tx('共同参与这次旅程的人。', 'People sharing this trip.')}</ThemedText></View>
              <ThemedText type="small" themeColor="textSecondary">{members.length}</ThemedText>
            </View>
            <View>
              {members.map((member, index) => {
                const expanded = editingMemberId === member.userId;
                const self = member.userId === currentUserId;
                return (
                  <View key={member.userId}>
                    {index > 0 ? <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} /> : null}
                    <Pressable accessible={isOwner && !self} disabled={!isOwner || self} accessibilityRole={isOwner && !self ? 'button' : undefined} accessibilityState={isOwner && !self ? { expanded } : undefined} onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setEditingMemberId(expanded ? undefined : member.userId); setConfirmRemoveId(undefined); }} style={({ pressed }) => [styles.memberRow, pressed && styles.pressed]}>
                      <MemberAvatar avatarUrl={member.avatarUrl} displayName={member.displayName} />
                      <View style={styles.memberCopy}><ThemedText type="smallBold">{member.displayName}{self ? tx('（你）', ' (you)') : ''}</ThemedText><ThemedText type="small" themeColor="textSecondary">{locale === 'zh-CN' ? tripRoleLabels[member.role] : tripRoleLabelsEn[member.role]}</ThemedText></View>
                      {isOwner && !self ? <ThemedText type="smallBold" themeColor="textSecondary">{expanded ? tx('收起', 'Close') : tx('管理', 'Manage')}</ThemedText> : null}
                    </Pressable>
                    {expanded ? (
                      <View style={[styles.memberEditor, { backgroundColor: theme.backgroundSelected }]}>
                        <ThemedText type="smallBold">{tx('权限', 'Access')}</ThemedText>
                        <View style={styles.roleRow}>
                          {(['owner', 'editor', 'viewer'] as TripRole[]).map((role) => <ChoiceChip key={role} selected={member.role === role} onPress={() => void changeRole(member.userId, role)}>{locale === 'zh-CN' ? tripRoleLabels[role] : tripRoleLabelsEn[role]}</ChoiceChip>)}
                        </View>
                        {confirmRemoveId === member.userId ? (
                          <View style={styles.removeConfirm}><ThemedText type="small" themeColor="textSecondary">{tx(`确定将 ${member.displayName} 移出行程？历史账目会保留。`, `Remove ${member.displayName}? Historical ledger records will stay.`)}</ThemedText><View style={styles.editorActions}><View style={styles.actionGrow}><ActionButton tone="secondary" onPress={() => setConfirmRemoveId(undefined)}>{tx('取消', 'Cancel')}</ActionButton></View><View style={styles.actionGrow}><ActionButton busy={busyAction === `remove-${member.userId}`} onPress={() => void confirmRemove(member.userId)}>{tx('确认移出', 'Remove')}</ActionButton></View></View></View>
                        ) : <Pressable accessibilityRole="button" onPress={() => setConfirmRemoveId(member.userId)} style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}><ThemedText type="smallBold" style={{ color: theme.danger }}>{tx('移出此行程', 'Remove from trip')}</ThemedText></Pressable>}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>

            {isOwner ? (
              <View style={[styles.inviteArea, { borderTopColor: theme.backgroundSelected }]}>
                <PanelHeading title={tx('邀请新同行者', 'Invite a traveller')} caption={tx('选择初始权限，生成一枚可分享的邀请码。', 'Choose initial access and create a shareable code.')} />
                <View style={styles.roleRow}><ChoiceChip selected={inviteRole === 'editor'} onPress={() => setInviteRole('editor')}>{tx('可编辑', 'Can edit')}</ChoiceChip><ChoiceChip selected={inviteRole === 'viewer'} onPress={() => setInviteRole('viewer')}>{tx('仅查看', 'View only')}</ChoiceChip></View>
                <ActionButton tone="secondary" busy={busyAction === 'invite'} onPress={() => void generateInvite()}>{tx('生成邀请码', 'Create invite code')}</ActionButton>
                {generatedInvite ? <InlineNotice>{tx('邀请码', 'Invite code')}：{generatedInvite.token}{'\n'}{tx('有效期至', 'Expires')}：{formatDateTime(generatedInvite.expiresAt)}</InlineNotice> : null}
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {trips.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeading}><ThemedText type="smallBold" style={styles.sectionTitle}>{tx('我的行程', 'My trips')}</ThemedText><ThemedText type="small" themeColor="textSecondary">{tx(`${trips.length} 个`, `${trips.length} total`)}</ThemedText></View>
          <View>{trips.map((trip, index) => { const selected = trip.id === activeTrip?.id; return <View key={trip.id}>{index > 0 ? <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} /> : null}<Pressable accessibilityRole="button" onPress={() => void openTrip(trip)} style={({ pressed }) => [styles.tripRow, pressed && styles.pressed]}><View style={styles.tripRowCopy}><ThemedText type="smallBold">{trip.name}</ThemedText><ThemedText type="small" themeColor="textSecondary">{trip.startsOn} — {trip.endsOn} · {trip.homeCurrency}</ThemedText></View>{selected ? <ThemedText type="small" themeColor="textSecondary">{tx('当前 · ', 'Current · ')}</ThemedText> : null}<ThemedText type="smallBold" style={{ color: theme.text }}>{tx('查看', 'View')}</ThemedText></Pressable></View>; })}</View>
        </View>
      ) : null}
    </Screen>
  );
}

function PanelHeading({ title, caption }: { title: string; caption: string }) { return <View style={styles.panelHeader}><ThemedText type="smallBold" style={styles.panelTitle}>{title}</ThemedText><ThemedText type="small" themeColor="textSecondary">{caption}</ThemedText></View>; }
function Detail({ label, value }: { label: string; value: string }) { return <View style={styles.detail}><ThemedText type="small" themeColor="textSecondary">{label}</ThemedText><ThemedText type="smallBold">{value}</ThemedText></View>; }

function TripForm(props: { name: string; setName: (value: string) => void; startsOn: string; setStartsOn: (value: string) => void; endsOn: string; setEndsOn: (value: string) => void; currency: string; setCurrency: (value: string) => void; timeZone: string; setTimeZone: (value: string) => void; currencyOptions: { label: string; value: string }[]; timeZoneOptions: { label: string; value: string }[]; tx: (zh: string, en: string) => string }) {
  return <View style={styles.formStack}><FormField label={props.tx('行程名称', 'Trip name')} value={props.name} onChangeText={props.setName} placeholder={props.tx('例如：北海道滑雪之旅', 'For example: Hokkaido ski trip')} /><View style={styles.formRow}><View style={styles.fieldGrow}><DateTimeField label={props.tx('开始日期', 'Start date')} value={props.startsOn} mode="date" onChange={props.setStartsOn} /></View><View style={styles.fieldGrow}><DateTimeField label={props.tx('结束日期', 'End date')} value={props.endsOn} mode="date" minimumDate={new Date(`${props.startsOn}T12:00:00`)} onChange={props.setEndsOn} /></View></View><View style={styles.formRow}><View style={styles.fieldGrow}><SelectionField label={props.tx('记账币种', 'Home currency')} value={props.currency} options={props.currencyOptions} onChange={props.setCurrency} /></View><View style={styles.fieldGrow}><SelectionField label={props.tx('行程时区', 'Time zone')} value={props.timeZone} options={props.timeZoneOptions} onChange={props.setTimeZone} /></View></View></View>;
}

const styles = StyleSheet.create({
  tripHero: { borderRadius: 16, padding: 20, gap: 20, shadowColor: '#17324D', shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 }, heroCopy: { flex: 1, gap: 4 }, tripName: { fontSize: 28, lineHeight: 36 },
  memberCount: { minHeight: 36, borderRadius: 999, paddingHorizontal: 12, justifyContent: 'center' },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, actionGrow: { flexGrow: 1, flexBasis: 150 },
  focusPanel: { borderRadius: 16, padding: 18, gap: 18, shadowColor: '#17324D', shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 7 } },
  panelHeader: { flex: 1, gap: 3 }, panelTitle: { fontSize: 20, lineHeight: 26 }, manageHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  formStack: { gap: 14 }, formRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, fieldGrow: { flexGrow: 1, flexBasis: 220 },
  section: { paddingTop: 20, gap: 12 }, sectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }, sectionHeadingCopy: { flex: 1, gap: 2 }, sectionTitle: { fontSize: 20, lineHeight: 26 },
  tripRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8 }, tripRowCopy: { flex: 1, gap: 2 }, divider: { height: StyleSheet.hairlineWidth },
  detailsBlock: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, detail: { flexGrow: 1, flexBasis: 150, gap: 2 },
  editorBlock: { gap: 14 }, editorActions: { flexDirection: 'row', gap: 10 },
  dangerAction: { minHeight: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center' },
  dangerZone: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 18, gap: 14 },
  dangerConfirm: { minHeight: 48, borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: '#B4413E' },
  dangerConfirmText: { color: '#FFFFFF' },
  travellersBlock: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 18, gap: 12 },
  memberRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }, memberCopy: { flex: 1, gap: 2 },
  memberEditor: { borderRadius: 12, marginBottom: 10, padding: 14, gap: 12 }, roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  removeConfirm: { gap: 10 }, textButton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  inviteArea: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 18, marginTop: 6, gap: 12 }, pressed: { opacity: 0.65 }, disabled: { opacity: 0.5 },
});
