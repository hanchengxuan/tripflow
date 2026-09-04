import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { Chevron } from '@/components/chevron';
import { ConfirmSheet } from '@/components/confirm-sheet';
import { ActionButton, InlineNotice } from '@/components/form-controls';
import { InviteSheet } from '@/components/invite-sheet';
import { JoinTripSheet } from '@/components/join-trip-sheet';
import { KindPill } from '@/components/kind-pill';
import { ListDivider, ListRow, ListSurface } from '@/components/list-surface';
import { MemberAccessSheet } from '@/components/member-access-sheet';
import { Screen } from '@/components/screen';
import { SectionHeading } from '@/components/section-heading';
import { ThemedText } from '@/components/themed-text';
import { TripFormSheet, type TripDraft } from '@/components/trip-form-sheet';
import { TripManageSheet } from '@/components/trip-manage-sheet';
import { TripOverviewCard } from '@/components/trip-overview-card';
import { tripRoleLabels, tripRoleLabelsEn } from '@/constants/options';
import { Spacing } from '@/constants/theme';
import type { Trip, TripRole } from '@/domain/models';
import { useI18n } from '@/features/i18n/i18n-provider';
import { buildInviteUrl, parseInviteToken } from '@/features/invites/invite-link';
import { useMvp } from '@/features/mvp/mvp-provider';
import { defaultHomeCurrency, newTripTimeZone, tripTimeZone } from '@/features/trips/trip-defaults';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/user-error';

type Panel = 'create' | 'join' | 'manage' | 'edit' | 'invite' | 'member' | 'deleteTrip' | 'removeMember';

function dateOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatTripRange(trip: Trip, locale: string) {
  const format = (value: string) => {
    const date = new Date(`${value}T12:00:00`);
    if (locale === 'zh-CN') return `${date.getMonth() + 1}月${date.getDate()}`;
    return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  };
  return `${format(trip.startsOn)} — ${format(trip.endsOn)}`;
}

/**
 * Trips.
 *
 * The page itself is something you read: the current trip, and the trips you
 * belong to. Every action — create, join, manage, edit, invite, change access,
 * remove someone, delete the trip — opens a panel. They used to unfold inside
 * the page, one inside another, under buttons that renamed themselves to 收起.
 */
export default function TripsScreen() {
  const params = useLocalSearchParams<{ invite?: string | string[] }>();
  const theme = useTheme();
  const { locale, formatDateTime, tx } = useI18n();
  const {
    trips, activeTrip, members, currentUserId, error, itineraryItems,
    selectTrip, createTrip, joinTrip, createInvite, saveTrip, deleteTrip, setMemberRole, removeMember,
  } = useMvp();

  const currentMember = members.find(({ userId }) => userId === currentUserId);
  const canEditTrip = currentMember?.role === 'owner' || currentMember?.role === 'editor';
  const isOwner = currentMember?.role === 'owner';
  const roleLabel = (role: TripRole) => locale === 'zh-CN' ? tripRoleLabels[role] : tripRoleLabelsEn[role];

  const [panel, setPanel] = useState<Panel>();
  const [draft, setDraft] = useState<TripDraft>(() => ({
    name: '',
    startsOn: dateOffset(30),
    endsOn: dateOffset(37),
    destinationText: '',
  }));
  const [inviteCode, setInviteCode] = useState('');
  const [scanningInvite, setScanningInvite] = useState(false);
  const [joinNotice, setJoinNotice] = useState<string>();
  const [generatedInvite, setGeneratedInvite] = useState<{ token: string; expiresAt: string }>();
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [memberId, setMemberId] = useState<string>();
  const [busyAction, setBusyAction] = useState<string>();
  const [panelError, setPanelError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const handledInviteParam = useRef<string | undefined>(undefined);
  const inviteParam = Array.isArray(params.invite) ? params.invite[0] : params.invite;

  const selectedMember = members.find(({ userId }) => userId === memberId);

  useEffect(() => {
    if (!inviteParam || handledInviteParam.current === inviteParam) return;
    handledInviteParam.current = inviteParam;
    const token = parseInviteToken(inviteParam);
    if (!token) return;
    const timeout = setTimeout(() => {
      setInviteCode(token);
      setScanningInvite(false);
      setJoinNotice(tx('已读取邀请，请确认后加入行程。', 'Invite loaded. Confirm to join the trip.'));
      setPanel('join');
    }, 0);
    return () => clearTimeout(timeout);
  }, [inviteParam, tx]);

  function editDraftFor(trip: Trip): TripDraft {
    return { name: trip.name, startsOn: trip.startsOn, endsOn: trip.endsOn, destinationText: '' };
  }

  function openPanel(next: Panel) {
    setPanelError(undefined);
    setSuccess(undefined);
    if (next === 'create') {
      setDraft({ name: '', startsOn: dateOffset(30), endsOn: dateOffset(37), destinationText: '' });
    }
    if (next === 'edit' && activeTrip) setDraft(editDraftFor(activeTrip));
    if (next === 'join') {
      setScanningInvite(false);
      setJoinNotice(undefined);
    }
    if (next === 'invite') setGeneratedInvite(undefined);
    setPanel(next);
  }

  function closePanel() {
    setPanel(undefined);
    setPanelError(undefined);
    setScanningInvite(false);
    setMemberId(undefined);
  }

  async function run(action: string, work: () => Promise<void>, successMessage?: string) {
    setBusyAction(action);
    setPanelError(undefined);
    try {
      await work();
      if (successMessage) setSuccess(successMessage);
    } catch (caught) {
      setPanelError(toUserMessage(caught));
    } finally {
      setBusyAction(undefined);
    }
  }

  async function openTrip(trip: Trip) {
    setSuccess(undefined);
    setPanelError(undefined);
    if (trip.id !== activeTrip?.id) await selectTrip(trip.id);
    setPanel('manage');
  }

  async function submitTrip() {
    await run('create', async () => {
      // Neither of these was asked for. The zone comes from the destination
      // typed into the form, or the device; the ledger's base currency starts
      // where this traveller's last one did, and is changed in the Ledger.
      await createTrip({
        name: draft.name,
        startsOn: draft.startsOn,
        endsOn: draft.endsOn,
        homeCurrency: defaultHomeCurrency(trips),
        defaultTimeZone: newTripTimeZone(draft.timeZone),
      });
      closePanel();
    }, tx('新行程已创建。', 'Trip created.'));
  }

  async function submitTripEdit() {
    await run('edit-trip', async () => {
      // Editing a trip cannot touch either: the RPC requires both, so the
      // stored values are passed straight back.
      await saveTrip({
        name: draft.name,
        startsOn: draft.startsOn,
        endsOn: draft.endsOn,
        homeCurrency: activeTrip?.homeCurrency ?? defaultHomeCurrency(trips),
        defaultTimeZone: draft.timeZone?.trim() || activeTrip?.defaultTimeZone || newTripTimeZone(),
      });
      setPanel('manage');
    }, tx('行程资料已更新。', 'Trip details updated.'));
  }

  async function permanentlyDeleteTrip() {
    await run('delete-trip', async () => {
      await deleteTrip();
      closePanel();
    }, tx('行程及其安排已永久删除。', 'Trip and its plans were permanently deleted.'));
  }

  async function submitInvite() {
    await run('join', async () => {
      await joinTrip(inviteCode);
      setInviteCode('');
      closePanel();
    }, tx('已加入行程。', 'You joined the trip.'));
  }

  async function generateInvite() {
    await run('invite', async () => {
      setGeneratedInvite(await createInvite(inviteRole));
    });
  }

  async function shareInvite() {
    if (!generatedInvite || !activeTrip) return;
    const link = buildInviteUrl(generatedInvite.token);
    await Share.share({
      message: tx(`加入我的 TripFlow 行程“${activeTrip.name}”：${link}`, `Join my TripFlow trip “${activeTrip.name}”: ${link}`),
      url: link,
    });
  }

  async function changeRole(userId: string, role: TripRole) {
    await run(`role-${userId}`, async () => {
      await setMemberRole(userId, role);
    }, tx('同行者权限已更新。', 'Traveller access updated.'));
  }

  async function confirmRemove(userId: string) {
    await run(`remove-${userId}`, async () => {
      await removeMember(userId);
      setMemberId(undefined);
      setPanel('manage');
    }, tx('同行者已移出此行程。', 'Traveller removed from this trip.'));
  }

  // Who you are on this trip, rather than a list of the sections below.
  const context = activeTrip
    ? [
        activeTrip.name,
        tx(`${members.length} 位同行者`, `${members.length} travelling`),
        tx(`共 ${trips.length} 个行程`, `${trips.length} trips`),
      ]
    : [tx('还没有行程', 'No trips yet')];

  return (
    <Screen context={context} title={tx('行程', 'Trips')}>
      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
      {success ? <InlineNotice>{success}</InlineNotice> : null}

      {activeTrip ? (
        <TripOverviewCard
          activeLabel={tx('进行中', 'Active')}
          currentLabel={tx('当前行程 Active', 'Current trip')}
          dateLabel={tx('日期 Dates', 'Dates')}
          dateRange={formatTripRange(activeTrip, locale)}
          manageLabel={tx('管理当前行程', 'Manage current trip')}
          onManage={() => void openTrip(activeTrip)}
          peopleCount={tx(`${members.length} 人`, `${members.length} people`)}
          peopleLabel={tx('同行 People', 'People')}
          title={activeTrip.name}
        />
      ) : null}

      {/* Neither button renames itself according to a panel below it. */}
      <View style={styles.quickActions}>
        <View style={styles.actionGrow}>
          <ActionButton tone={activeTrip ? 'secondary' : 'primary'} onPress={() => openPanel('create')}>{tx('新建行程', 'New trip')}</ActionButton>
        </View>
        <View style={styles.actionGrow}>
          <ActionButton tone="secondary" onPress={() => openPanel('join')}>{tx('加入行程', 'Join a trip')}</ActionButton>
        </View>
      </View>

      {trips.length > 0 ? (
        <View style={styles.section}>
          <SectionHeading title={tx('我的行程', 'My trips')} trailing={<ThemedText type="small" themeColor="textMuted">{trips.length}</ThemedText>} />
          <ListSurface>
            {trips.map((trip, index) => (
              <View key={trip.id}>
                {index > 0 ? <ListDivider /> : null}
                {/* One affordance: the row opens the trip. The 「查看」 link
                    that sat beside the press target said the same thing. */}
                <ListRow
                  onPress={() => void openTrip(trip)}
                  subtitle={formatTripRange(trip, locale)}
                  title={trip.name}
                  trailing={
                    <View style={styles.rowTrailing}>
                      {trip.id === activeTrip?.id ? (
                        <KindPill color={theme.kindActivity} label={tx('当前', 'Current')} softColor={theme.kindActivitySoft} />
                      ) : null}
                      <Chevron color={theme.textMuted} />
                    </View>
                  }
                />
              </View>
            ))}
          </ListSurface>
        </View>
      ) : null}

      <TripFormSheet
        busy={busyAction === 'create' || busyAction === 'edit-trip'}
        draft={draft}
        error={panelError}
        mode={panel === 'edit' ? 'edit' : 'create'}
        onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
        onDismiss={panel === 'edit' ? () => setPanel('manage') : closePanel}
        onSubmit={() => void (panel === 'edit' ? submitTripEdit() : submitTrip())}
        tx={tx}
        visible={panel === 'create' || panel === 'edit'}
      />

      <JoinTripSheet
        busy={busyAction === 'join'}
        code={inviteCode}
        error={panelError}
        notice={joinNotice}
        onChangeCode={setInviteCode}
        onDismiss={closePanel}
        onScanned={(token) => {
          setInviteCode(token);
          setScanningInvite(false);
          setJoinNotice(tx('二维码已识别，请确认后加入行程。', 'QR code recognized. Confirm to join the trip.'));
        }}
        onSubmit={() => void submitInvite()}
        onToggleScanner={() => setScanningInvite((current) => !current)}
        scanning={scanningInvite}
        tx={tx}
        visible={panel === 'join'}
      />

      {activeTrip ? (
        <TripManageSheet
          canEdit={canEditTrip}
          currentUserId={currentUserId}
          isOwner={isOwner}
          members={members}
          onDelete={activeTrip.createdBy === currentUserId ? () => setPanel('deleteTrip') : undefined}
          onDismiss={closePanel}
          onEdit={() => openPanel('edit')}
          onInvite={() => openPanel('invite')}
          onMember={(userId) => { setMemberId(userId); setPanel('member'); }}
          roleLabel={roleLabel}
          timeZone={tripTimeZone(activeTrip, itineraryItems)}
          trip={activeTrip}
          tripRange={formatTripRange(activeTrip, locale)}
          tx={tx}
          visible={panel === 'manage'}
        />
      ) : null}

      <InviteSheet
        busy={busyAction === 'invite'}
        error={panelError}
        expiresLabel={generatedInvite ? formatDateTime(generatedInvite.expiresAt) : undefined}
        invite={generatedInvite}
        inviteUrl={generatedInvite ? buildInviteUrl(generatedInvite.token) : undefined}
        onDismiss={() => setPanel('manage')}
        onGenerate={() => void generateInvite()}
        onRoleChange={setInviteRole}
        onShare={() => void shareInvite()}
        role={inviteRole}
        tx={tx}
        visible={panel === 'invite'}
      />

      <MemberAccessSheet
        busy={Boolean(busyAction?.startsWith('role-'))}
        error={panelError}
        member={selectedMember}
        onDismiss={() => { setMemberId(undefined); setPanel('manage'); }}
        onRemove={() => setPanel('removeMember')}
        onRoleChange={(role) => { if (selectedMember) void changeRole(selectedMember.userId, role); }}
        roleLabel={roleLabel}
        tx={tx}
        visible={panel === 'member'}
      />

      {activeTrip ? (
        <ConfirmSheet
          busy={busyAction === 'delete-trip'}
          confirmLabel={tx('确认永久删除', 'Delete permanently')}
          consequence={tx('所有安排、分账、转账记录和收据都会删除，且无法恢复。只有创建者可以执行。',
                          'All plans, expenses, transfers, and receipts will be deleted and cannot be recovered. Only the creator can do this.')}
          detail={`${formatTripRange(activeTrip, locale)} · ${tx(`${members.length} 位同行者`, `${members.length} travelling`)}`}
          error={panelError}
          onConfirm={() => void permanentlyDeleteTrip()}
          onDismiss={() => setPanel('manage')}
          title={tx(`永久删除“${activeTrip.name}”？`, `Permanently delete “${activeTrip.name}”?`)}
          visible={panel === 'deleteTrip'}
        />
      ) : null}

      {selectedMember ? (
        <ConfirmSheet
          busy={busyAction === `remove-${selectedMember.userId}`}
          confirmLabel={tx('移出此行程', 'Remove from trip')}
          consequence={tx('他们会失去这个行程的访问权限，历史账目会保留。', 'They lose access to this trip. Historical ledger records stay.')}
          detail={roleLabel(selectedMember.role)}
          error={panelError}
          onConfirm={() => void confirmRemove(selectedMember.userId)}
          onDismiss={() => setPanel('member')}
          title={tx(`将 ${selectedMember.displayName} 移出行程？`, `Remove ${selectedMember.displayName}?`)}
          visible={panel === 'removeMember'}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  quickActions: { flexDirection: 'row', gap: Spacing.sm },
  actionGrow: { flex: 1, minWidth: 0 },
  section: { gap: Spacing.sm },
  rowTrailing: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
});
