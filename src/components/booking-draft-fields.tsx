import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { BookingPreview } from '@/features/bookings/booking-preview';
import { destinationLabel } from '@/features/destinations/destination-search';
import { DestinationField } from '@/components/destination-field';
import { ChoiceChip, FormField, InlineNotice } from '@/components/form-controls';
import { SelectionField } from '@/components/selection-field';
import { ThemedText } from '@/components/themed-text';
import { getTimeZoneOptions } from '@/constants/options';
import { Spacing } from '@/constants/theme';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useTheme } from '@/hooks/use-theme';

export function BookingDraftFields({ draft, index, selected, onToggle, onChange }: {
  draft: BookingPreview; index: number; selected: boolean; onToggle: () => void; onChange: (patch: Partial<BookingPreview>) => void;
}) {
  const { locale, tx } = useI18n();
  const theme = useTheme();
  const [destinationText, setDestinationText] = useState(draft.destination ? destinationLabel(draft.destination) : '');
  const [editing, setEditing] = useState(!draft.title || !draft.location || !draft.startLocal || !draft.endLocal || !draft.startTimeZone || !draft.endTimeZone);
  const zoneOptions = (zone: string) => {
    const options = getTimeZoneOptions(locale === 'en');
    return [{ value: '', label: tx('选择时区', 'Choose a time zone') }, ...(!zone || options.some((entry) => entry.value === zone) ? [] : [{ value: zone, label: zone }]), ...options];
  };
  const missing = !draft.title || !draft.location || !draft.startLocal || !draft.endLocal || !draft.startTimeZone || !draft.endTimeZone;
  return (
    <View style={[styles.section, { borderColor: theme.border }]}>
      <View style={styles.heading}>
        <ThemedText type="smallBold" style={styles.headingText}>{`${index + 1} · ` + (draft.kind === 'hotel' ? tx('酒店', 'Hotel') : tx('航班', 'Flight'))}</ThemedText>
        <ChoiceChip selected={selected} onPress={onToggle}>{tx('加入', 'Include')}</ChoiceChip>
      </View>
      {draft.kind === 'flight' && draft.flightNumber && !draft.title.includes(draft.flightNumber) ? <ThemedText type="small" themeColor="textSecondary">{[draft.flightNumber, draft.departureAirport && draft.arrivalAirport ? `${draft.departureAirport} → ${draft.arrivalAirport}` : ''].filter(Boolean).join(' · ')}</ThemedText> : null}
      {missing ? <InlineNotice>{tx('有信息未识别，请补全后加入。', 'Some details are missing. Complete them before adding.')}</InlineNotice> : null}
      {draft.warnings.map((warning, position) => <ThemedText key={position} type="small" themeColor="textSecondary">{warning}</ThemedText>)}
      <ThemedText type="smallBold">{draft.title || tx('未命名订单', 'Untitled booking')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{draft.location}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{[draft.startLocal, draft.startTimeZone].filter(Boolean).join(' · ') + ' → ' + [draft.endLocal, draft.endTimeZone].filter(Boolean).join(' · ')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{draft.destination ? tx(`地图：${destinationLabel(draft.destination)}`, `Map: ${destinationLabel(draft.destination)}`) : tx('尚未设置地图目的地，可在编辑信息中选择城市。', 'Choose a city in Edit details to include this plan on the map.')}</ThemedText>
      {selected ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: editing }} onPress={() => setEditing((value) => !value)} style={styles.editButton}>
        <ThemedText type="smallBold" themeColor="link">{editing ? tx('收起编辑', 'Close editing') : tx('编辑信息', 'Edit details')}</ThemedText>
      </Pressable> : null}
      {selected && editing ? <>
        <FormField label={tx('安排名称', 'Plan title')} value={draft.title} maxLength={180} onChangeText={(title) => onChange({ title })} />
        <DestinationField value={destinationText} planTitle={draft.title} locationName={draft.location}
          onChange={(value) => { setDestinationText(value); onChange({ destination: undefined }); }}
          onSelect={(place) => {
            setDestinationText(destinationLabel(place));
            onChange({ destination: { cityName: place.cityName, countryName: place.countryName, countryCode: place.countryCode, timeZone: place.timeZone, currency: place.currency, latitude: place.latitude, longitude: place.longitude } });
          }} />
        <ThemedText type="small" themeColor="textSecondary">{tx('选择城市用于地图，不会改变下方订单的当地时间。', 'Choose a city for the map. Booking local times below stay as entered.')}</ThemedText>
        <FormField label={draft.kind === 'hotel' ? tx('酒店地址', 'Hotel address') : tx('到达机场／地点', 'Arrival airport / place')} value={draft.location} maxLength={500} onChangeText={(location) => onChange({ location })} />
        <FormField label={draft.kind === 'hotel' ? tx('入住当地时间', 'Local check-in time') : tx('出发当地时间', 'Local departure time')} value={draft.startLocal} placeholder="2026-10-20 15:00" autoCorrect={false} onChangeText={(startLocal) => onChange({ startLocal })} />
        <SelectionField label={tx('开始时区', 'Start time zone')} value={draft.startTimeZone} options={zoneOptions(draft.startTimeZone)} onChange={(startTimeZone) => onChange({ startTimeZone })} />
        <FormField label={draft.kind === 'hotel' ? tx('退房当地时间', 'Local check-out time') : tx('到达当地时间', 'Local arrival time')} value={draft.endLocal} placeholder="2026-10-23 11:00" autoCorrect={false} onChangeText={(endLocal) => onChange({ endLocal })} />
        <SelectionField label={tx('结束时区', 'End time zone')} value={draft.endTimeZone} options={zoneOptions(draft.endTimeZone)} onChange={(endTimeZone) => onChange({ endTimeZone })} />
        <ThemedText type="small" themeColor="textSecondary">{tx('格式：年-月-日 时:分，例如 2026-10-20 15:00', 'Format: YYYY-MM-DD HH:mm, for example 2026-10-20 15:00')}</ThemedText>
      </> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { width: '100%', gap: Spacing.sm, paddingTop: Spacing.lg, borderTopWidth: StyleSheet.hairlineWidth },
  heading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  headingText: { flex: 1 },
  editButton: { minHeight: 44, justifyContent: 'center' },
});
