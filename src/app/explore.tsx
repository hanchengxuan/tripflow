import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionButton, ChoiceChip, FormField, InlineNotice } from '@/components/form-controls';
import { InfoCard } from '@/components/info-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { signOut } from '@/features/auth/auth-service';
import { useMvp } from '@/features/mvp/mvp-provider';

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
    saveProfile,
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
  const [displayName, setDisplayName] = useState('');
  const [busyAction, setBusyAction] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const [success, setSuccess] = useState<string>();

  const tripSummary = useMemo(
    () => activeTrip ? `${activeTrip.startsOn} – ${activeTrip.endsOn} · ${activeTrip.homeCurrency}` : 'Create a new trip or enter an invite code.',
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
      setActionError(caught instanceof Error ? caught.message : 'The action could not be completed.');
    } finally {
      setBusyAction(undefined);
    }
  }

  async function submitTrip() {
    await run('create', async () => {
      await createTrip({ name, startsOn, endsOn, homeCurrency: currency, defaultTimeZone: timeZone });
      setName('');
    }, 'Trip created. You are the owner.');
  }

  async function submitInvite() {
    await run('join', async () => {
      await joinTrip(inviteCode);
      setInviteCode('');
    }, 'Invite accepted. Welcome to the trip.');
  }

  async function generateInvite() {
    await run('invite', async () => {
      setGeneratedInvite(await createInvite(inviteRole));
    });
  }

  return (
    <Screen eyebrow="Trips & people" title={activeTrip?.name ?? 'Your trips'} subtitle={tripSummary}>
      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
      {actionError ? <InlineNotice tone="error">{actionError}</InlineNotice> : null}
      {success ? <InlineNotice>{success}</InlineNotice> : null}
      {loading ? <InlineNotice>Synchronizing trip membership…</InlineNotice> : null}

      {trips.length > 0 ? (
        <InfoCard label="ACTIVE TRIP" title="Switch trip">
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
        <InfoCard label="TRAVELERS" title={`${members.length} member${members.length === 1 ? '' : 's'}`}>
          <View style={styles.memberList}>
            {members.map((member) => (
              <View key={member.userId} style={styles.memberRow}>
                <ThemedText>{member.displayName}</ThemedText>
                <ThemedText type="smallBold" themeColor="textSecondary">{member.role}</ThemedText>
              </View>
            ))}
          </View>
          <View style={styles.form}>
            <FormField label="Your display name" value={displayName} onChangeText={setDisplayName} placeholder={currentMember?.displayName ?? 'Liam'} />
            <ActionButton
              tone="secondary"
              busy={busyAction === 'profile'}
              disabled={!displayName.trim()}
              onPress={() => void run('profile', () => saveProfile(displayName), 'Profile updated.')}>
              Save profile
            </ActionButton>
          </View>
        </InfoCard>
      ) : null}

      {activeTrip && isOwner ? (
        <InfoCard label="INVITE" title="Bring your group in under a minute" accent="#4B67D1">
          <View style={styles.form}>
            <View style={styles.chips}>
              <ChoiceChip selected={inviteRole === 'editor'} onPress={() => setInviteRole('editor')}>Editor</ChoiceChip>
              <ChoiceChip selected={inviteRole === 'viewer'} onPress={() => setInviteRole('viewer')}>Viewer</ChoiceChip>
            </View>
            <ActionButton busy={busyAction === 'invite'} onPress={() => void generateInvite()}>Generate invite code</ActionButton>
            {generatedInvite ? (
              <InlineNotice>
                Code: {generatedInvite.token}{'\n'}Expires: {new Date(generatedInvite.expiresAt).toLocaleString()}
              </InlineNotice>
            ) : null}
          </View>
        </InfoCard>
      ) : null}

      <InfoCard label="JOIN" title="Enter a TripFlow invite code" accent="#E7863C">
        <View style={styles.form}>
          <FormField
            label="Invite code"
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="none"
            placeholder="48-character code"
          />
          <ActionButton busy={busyAction === 'join'} disabled={inviteCode.trim().length !== 48} onPress={() => void submitInvite()}>
            Join trip
          </ActionButton>
        </View>
      </InfoCard>

      <InfoCard label="NEW TRIP" title="Create the shared workspace">
        <View style={styles.form}>
          <FormField label="Trip name" value={name} onChangeText={setName} placeholder="Year-end Asia 2026" />
          <View style={styles.row}>
            <View style={styles.grow}><FormField label="Start date" value={startsOn} onChangeText={setStartsOn} /></View>
            <View style={styles.grow}><FormField label="End date" value={endsOn} onChangeText={setEndsOn} /></View>
          </View>
          <View style={styles.row}>
            <View style={styles.grow}><FormField label="Home currency" value={currency} onChangeText={setCurrency} autoCapitalize="characters" maxLength={3} /></View>
            <View style={styles.grow}><FormField label="Time zone" value={timeZone} onChangeText={setTimeZone} /></View>
          </View>
          <ActionButton busy={busyAction === 'create'} disabled={!name.trim()} onPress={() => void submitTrip()}>Create trip</ActionButton>
        </View>
      </InfoCard>

      <ActionButton tone="danger" busy={busyAction === 'signout'} onPress={() => void run('signout', signOut)}>Sign out</ActionButton>
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
