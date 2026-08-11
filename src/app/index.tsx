import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionButton, ChoiceChip, FormField, InlineNotice } from '@/components/form-controls';
import { InfoCard } from '@/components/info-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useMvp } from '@/features/mvp/mvp-provider';
import type { ItineraryKind } from '@/domain/models';

const itemKinds: ItineraryKind[] = ['transport', 'lodging', 'food', 'activity', 'note', 'task'];

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
      if (Number.isNaN(startsAt.getTime())) throw new Error('Enter a valid date and time.');
      await addItineraryItem({ title, locationLabel: location, kind, startsAt: startsAt.toISOString() });
      setTitle('');
      setLocation('');
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Could not add the itinerary item.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      eyebrow={activeTrip ? `${activeTrip.startsOn} – ${activeTrip.endsOn}` : 'Today'}
      title={activeTrip?.name ?? 'Start your first trip'}
      subtitle={activeTrip ? `${members.length} traveler${members.length === 1 ? '' : 's'} · ${activeTrip.homeCurrency} home currency` : 'Create or join a trip from the Trips tab.'}>
      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
      {loading ? <InlineNotice>Refreshing the shared timeline…</InlineNotice> : null}

      {!activeTrip ? (
        <InfoCard label="NO ACTIVE TRIP" title="Create or join a shared trip">
          <ThemedText themeColor="textSecondary">
            Once you join, the next confirmed itinerary item will appear here for the whole group.
          </ThemedText>
        </InfoCard>
      ) : upcomingItems.length > 0 ? (
        upcomingItems.map((item, index) => (
          <InfoCard
            key={item.id}
            label={index === 0 ? 'NEXT STEP' : item.kind.toUpperCase()}
            title={item.title}
            accent={index === 0 ? '#0F9D7A' : '#4B67D1'}>
            <ThemedText themeColor="textSecondary">
              {new Date(item.startsAt).toLocaleString()}
              {item.locationLabel ? ` · ${item.locationLabel}` : ''}
            </ThemedText>
          </InfoCard>
        ))
      ) : (
        <InfoCard label="TIMELINE READY" title="Nothing scheduled yet">
          <ThemedText themeColor="textSecondary">Add the first shared item below.</ThemedText>
        </InfoCard>
      )}

      {activeTrip && canEdit ? (
        <InfoCard label="QUICK ADD" title="Add to the shared timeline" accent="#E7863C">
          <View style={styles.form}>
            <FormField label="Title" value={title} onChangeText={setTitle} placeholder="Airport Express to Central" />
            <FormField label="Location" value={location} onChangeText={setLocation} placeholder="Hong Kong Station" />
            <View style={styles.row}>
              <View style={styles.grow}><FormField label="Date" value={date} onChangeText={setDate} placeholder="2026-12-01" /></View>
              <View style={styles.grow}><FormField label="Time" value={time} onChangeText={setTime} placeholder="09:00" /></View>
            </View>
            <View style={styles.chips}>
              {itemKinds.map((itemKind) => (
                <ChoiceChip key={itemKind} selected={kind === itemKind} onPress={() => setKind(itemKind)}>
                  {itemKind}
                </ChoiceChip>
              ))}
            </View>
            <ActionButton busy={busy} disabled={!title.trim()} onPress={submitItem}>Add itinerary item</ActionButton>
            {formError ? <InlineNotice tone="error">{formError}</InlineNotice> : null}
          </View>
        </InfoCard>
      ) : activeTrip ? (
        <InlineNotice>Viewer access: you can follow the shared timeline but cannot edit it.</InlineNotice>
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
