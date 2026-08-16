import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { DateTimePairField } from '@/components/date-time-field';
import { DestinationField } from '@/components/destination-field';
import { ActionButton, ChoiceChip, FormField, InlineNotice } from '@/components/form-controls';
import { LocationField } from '@/components/location-field';
import { Chevron } from '@/components/chevron';
import { SelectionField } from '@/components/selection-field';
import { ThemedText } from '@/components/themed-text';
import { getCurrencyOptions, getTimeZoneOptions, itineraryKindLabels, itineraryKindLabelsEn, itineraryKinds } from '@/constants/options';
import { Spacing } from '@/constants/theme';
import type { ItineraryDestination, ItineraryItem, ItineraryKind, Trip } from '@/domain/models';
import { destinationLabel, type DestinationSuggestion } from '@/features/destinations/destination-search';
import { useI18n } from '@/features/i18n/i18n-provider';
import { toUserMessage } from '@/lib/user-error';
import { formatZonedDateTimeRange, isoToZonedDateTime, zonedDateTimeToIso } from '@/lib/trip-time';
import { useTheme } from '@/hooks/use-theme';

export interface ItineraryComposerSheetProps {
  activeTrip: Trip;
  editingItem?: ItineraryItem;
  onAdd: (input: {
    title: string;
    kind: ItineraryKind;
    startsAt: string;
    endsAt: string;
    locationLabel?: string;
    googlePlaceId?: string;
    destination?: ItineraryDestination;
  }) => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
  onDismiss: () => void;
  onExtendTrip: (range: { startsOn: string; endsOn: string }) => Promise<void>;
  onSave: (input: {
    itemId: string;
    title: string;
    startsAt: string;
    endsAt: string;
    locationLabel?: string;
    googlePlaceId?: string;
    destination?: ItineraryDestination;
  }) => Promise<void>;
  onSuccess?: (message: string) => void;
  visible: boolean;
}

export function ItineraryComposerSheet({
  activeTrip,
  editingItem,
  onAdd,
  onDelete,
  onDismiss,
  onExtendTrip,
  onSave,
  onSuccess,
  visible,
}: ItineraryComposerSheetProps) {
  const { locale, languageTag, tx } = useI18n();
  const theme = useTheme();
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [googlePlaceId, setGooglePlaceId] = useState('');
  const [destinationText, setDestinationText] = useState('');
  const [destination, setDestination] = useState<ItineraryDestination>();
  const [itemTimeZone, setItemTimeZone] = useState(activeTrip.defaultTimeZone);
  const [itemCurrency, setItemCurrency] = useState(activeTrip.homeCurrency);
  const [destinationSettingsOpen, setDestinationSettingsOpen] = useState(false);
  const [date, setDate] = useState(activeTrip.startsOn);
  const [endDate, setEndDate] = useState(activeTrip.startsOn);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:30');
  const [kind, setKind] = useState<ItineraryKind>('activity');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [pendingTripRange, setPendingTripRange] = useState<{ startsOn: string; endsOn: string }>();
  const [confirmDeleteItem, setConfirmDeleteItem] = useState(false);

  const destinationCurrencyOptions = getCurrencyOptions(locale === 'en');
  const destinationTimeZoneOptions = getTimeZoneOptions(locale === 'en');
  const effectiveItemTimeZone = destination?.timeZone ? itemTimeZone : activeTrip.defaultTimeZone;
  const kindLabel = (itemKind: ItineraryKind) => locale === 'zh-CN' ? itineraryKindLabels[itemKind] : itineraryKindLabelsEn[itemKind];

  useEffect(() => {
    if (!visible) return;
    const timeout = setTimeout(() => {
      if (editingItem) {
        const nextTimeZone = editingItem.destination?.timeZone ?? activeTrip.defaultTimeZone;
        const start = isoToZonedDateTime(editingItem.startsAt, nextTimeZone);
        const end = isoToZonedDateTime(editingItem.endsAt ?? editingItem.startsAt, nextTimeZone);
        setTitle(editingItem.title);
        setLocation(editingItem.locationLabel ?? '');
        setGooglePlaceId(editingItem.googlePlaceId ?? '');
        setDestination(editingItem.destination);
        setDestinationText(editingItem.destination ? destinationLabel(editingItem.destination) : '');
        setItemTimeZone(nextTimeZone);
        setItemCurrency(editingItem.destination?.currency ?? activeTrip.homeCurrency);
        setDate(start.date);
        setStartTime(start.time);
        setEndDate(end.date);
        setEndTime(end.time);
        setKind(editingItem.kind);
      } else {
        setTitle('');
        setLocation('');
        setGooglePlaceId('');
        setDestinationText('');
        setDestination(undefined);
        setItemTimeZone(activeTrip.defaultTimeZone);
        setItemCurrency(activeTrip.homeCurrency);
        setDate(activeTrip.startsOn);
        setEndDate(activeTrip.startsOn);
        setStartTime('09:00');
        setEndTime('10:30');
        setKind('activity');
      }
      setDestinationSettingsOpen(false);
      setFormError(undefined);
      setPendingTripRange(undefined);
      setConfirmDeleteItem(false);
    }, 0);
    return () => clearTimeout(timeout);
  }, [activeTrip.defaultTimeZone, activeTrip.homeCurrency, activeTrip.id, activeTrip.startsOn, editingItem, visible]);

  function updatePlanDate(value: string) {
    setDate(value);
    if (endDate < value) setEndDate(value);
    setPendingTripRange(undefined);
  }

  function updatePlanEndDate(value: string) {
    setEndDate(value);
    setPendingTripRange(undefined);
  }

  function chooseKind(nextKind: ItineraryKind) {
    setKind(nextKind);
    if (nextKind !== 'lodging') return;
    setStartTime('15:00');
    setEndTime('11:00');
    const nextDay = new Date(`${date}T12:00:00`);
    nextDay.setDate(nextDay.getDate() + 1);
    setEndDate(nextDay.toISOString().slice(0, 10));
  }

  function chooseDestination(next: DestinationSuggestion) {
    const nextDestination: ItineraryDestination = {
      cityName: next.cityName,
      countryName: next.countryName,
      countryCode: next.countryCode,
      timeZone: next.timeZone,
      currency: next.currency,
      latitude: next.latitude,
      longitude: next.longitude,
    };
    setDestination(nextDestination);
    setDestinationText(destinationLabel(next));
    setItemTimeZone(next.timeZone);
    setItemCurrency(next.currency ?? activeTrip.homeCurrency);
    setDestinationSettingsOpen(false);
    if (!location.trim()) setLocation(next.cityName);
  }

  function changeDestinationText(value: string) {
    setDestinationText(value);
    if (destination && value !== destinationLabel(destination)) setDestination(undefined);
  }

  async function submitItem(acceptTripRangeChange = false) {
    setBusy(true);
    setFormError(undefined);
    try {
      if (kind === 'lodging' && !location.trim()) {
        throw new Error(tx('请先选择酒店或住宿地点。', 'Choose the hotel or stay location first.'));
      }
      const startsAt = zonedDateTimeToIso(date, startTime, effectiveItemTimeZone);
      const endsAt = editingItem?.linkedStayId && editingItem.endsAt
        ? editingItem.endsAt
        : zonedDateTimeToIso(endDate, endTime, effectiveItemTimeZone);
      if (new Date(endsAt) <= new Date(startsAt)) {
        throw new Error(tx('结束时间需要晚于开始时间。', 'End time must be later than start time.'));
      }

      const nextTripRange = {
        startsOn: date < activeTrip.startsOn ? date : activeTrip.startsOn,
        endsOn: endDate > activeTrip.endsOn ? endDate : activeTrip.endsOn,
      };
      const tripRangeChanged = nextTripRange.startsOn !== activeTrip.startsOn || nextTripRange.endsOn !== activeTrip.endsOn;
      if (!editingItem && tripRangeChanged && !acceptTripRangeChange) {
        setPendingTripRange(nextTripRange);
        return;
      }
      if (!editingItem && tripRangeChanged) await onExtendTrip(nextTripRange);

      const destinationForSave = destination
        ? { ...destination, timeZone: itemTimeZone, currency: itemCurrency || destination.currency }
        : undefined;
      if (editingItem) {
        await onSave({
          itemId: editingItem.id,
          title,
          locationLabel: editingItem.linkedStayId ? editingItem.locationLabel : location,
          googlePlaceId: editingItem.linkedStayId ? editingItem.googlePlaceId : googlePlaceId,
          destination: editingItem.linkedStayId ? editingItem.destination : destinationForSave,
          startsAt,
          endsAt,
        });
      } else {
        await onAdd({ title, kind, locationLabel: location, googlePlaceId, destination: destinationForSave, startsAt, endsAt });
      }

      onDismiss();
      onSuccess?.(
        tripRangeChanged
          ? tx('行程日期已扩展，安排已加入时间线。', 'Trip dates were extended and the plan was added to the timeline.')
          : editingItem
          ? (kind === 'lodging' ? tx('住宿已更新。', 'Stay updated.') : tx('安排已更新。', 'Plan updated.'))
          : (kind === 'lodging' ? tx('住宿已加入时间线。', 'Stay added to the timeline.') : tx('安排已加入共享时间线。', 'Plan added to the shared timeline.')),
      );
    } catch (caught) {
      setFormError(toUserMessage(caught, tx('无法保存行程安排，请稍后重试。', 'Could not save this plan. Please try again.')));
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelectedItem() {
    if (!editingItem) return;
    setBusy(true);
    setFormError(undefined);
    try {
      await onDelete(editingItem.id);
      onDismiss();
      onSuccess?.(editingItem.kind === 'lodging'
        ? tx('住宿及其关联的酒店交通已删除。', 'Stay and its linked hotel transfer were deleted.')
        : tx('安排已删除。', 'Plan deleted.'));
    } catch (caught) {
      setFormError(toUserMessage(caught, tx('无法删除这项安排，请稍后重试。', 'Could not delete this plan. Please try again.')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      onDismiss={onDismiss}
      title={editingItem ? tx('编辑安排', 'Edit plan') : tx('添加安排', 'Add plan')}
      visible={visible}
    >
      <View style={styles.form}>
        {!editingItem ? (
          <View style={styles.kindChoices}>
            {itineraryKinds.map((itemKind) => (
              <ChoiceChip key={itemKind} role="radio" selected={kind === itemKind} onPress={() => chooseKind(itemKind)}>
                {kindLabel(itemKind)}
              </ChoiceChip>
            ))}
          </View>
        ) : null}
        <FormField label={tx('安排', 'Plan')} value={title} onChangeText={setTitle} placeholder={tx('例如：机场快线 → 中环', 'For example: Airport Express → Central')} />
        {editingItem?.linkedStayId ? (
          <View style={[styles.lockedDestination, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold">{tx('酒店交通', 'Hotel transfer')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {tx(`${editingItem.locationLabel ?? '—'} · ${formatZonedDateTimeRange(editingItem.endsAt ?? editingItem.startsAt, undefined, languageTag, activeTrip.defaultTimeZone)}`, `${editingItem.locationLabel ?? '—'} · ${formatZonedDateTimeRange(editingItem.endsAt ?? editingItem.startsAt, undefined, languageTag, activeTrip.defaultTimeZone)}`)}
            </ThemedText>
          </View>
        ) : (
          <>
            <DestinationField
              value={destinationText}
              tripName={activeTrip.name}
              planTitle={title}
              locationName={location}
              onChange={changeDestinationText}
              onSelect={chooseDestination}
            />
            {destination ? (
              <DestinationSettings
                currency={itemCurrency}
                currencyOptions={destinationCurrencyOptions}
                destination={destination}
                open={destinationSettingsOpen}
                timeZone={itemTimeZone}
                timeZoneOptions={destinationTimeZoneOptions}
                onCurrencyChange={setItemCurrency}
                onTimeZoneChange={setItemTimeZone}
                onToggle={() => setDestinationSettingsOpen((current) => !current)}
                tx={tx}
              />
            ) : null}
            <LocationField
              value={location}
              onChange={(value) => { setLocation(value); setGooglePlaceId(''); }}
              onSelect={(suggestion) => { setLocation(suggestion.text); setGooglePlaceId(suggestion.placeId); }}
            />
          </>
        )}
        {editingItem?.linkedStayId ? (
          <DateTimePairField
            label={tx('时间', 'When')}
            dateLabel={tx('日期', 'Date')}
            dateValue={date}
            timeLabel={tx('开始时间', 'Start time')}
            timeValue={startTime}
            onDateChange={updatePlanDate}
            onTimeChange={setStartTime}
          />
        ) : kind === 'lodging' ? (
          <View style={styles.dateTimeRow}>
            <DateTimePairField label={tx('入住', 'Check-in')} dateLabel={tx('入住日期', 'Check-in date')} dateValue={date} timeLabel={tx('入住时间', 'Check-in time')} timeValue={startTime} onDateChange={updatePlanDate} onTimeChange={setStartTime} />
            <DateTimePairField label={tx('退房', 'Check-out')} dateLabel={tx('退房日期', 'Check-out date')} dateValue={endDate} timeLabel={tx('退房时间', 'Check-out time')} timeValue={endTime} onDateChange={updatePlanEndDate} onTimeChange={setEndTime} />
          </View>
        ) : (
          <View style={styles.dateTimeRow}>
            <DateTimePairField label={tx('开始', 'Start')} dateLabel={tx('开始日期', 'Start date')} dateValue={date} timeLabel={tx('开始时间', 'Start time')} timeValue={startTime} onDateChange={updatePlanDate} onTimeChange={setStartTime} />
            <DateTimePairField label={tx('结束', 'End')} dateLabel={tx('结束日期', 'End date')} dateValue={endDate} timeLabel={tx('结束时间', 'End time')} timeValue={endTime} onDateChange={updatePlanEndDate} onTimeChange={setEndTime} />
          </View>
        )}
        {editingItem && !confirmDeleteItem ? (
          <Pressable accessibilityRole="button" onPress={() => setConfirmDeleteItem(true)} style={({ pressed }) => [styles.deleteTrigger, pressed && styles.pressed]}>
            <ThemedText type="smallBold" style={{ color: theme.danger }}>{tx('删除这项安排', 'Delete this plan')}</ThemedText>
          </Pressable>
        ) : null}
        {pendingTripRange ? (
          <View style={styles.rangeConfirm}>
            <InlineNotice>{tx(`这项安排超出当前行程。要把行程调整为 ${pendingTripRange.startsOn} — ${pendingTripRange.endsOn} 吗？`, `This plan is outside the current trip. Extend it to ${pendingTripRange.startsOn} — ${pendingTripRange.endsOn}?`)}</InlineNotice>
            <View style={styles.formActions}>
              <View style={styles.actionGrow}><ActionButton tone="secondary" onPress={() => setPendingTripRange(undefined)}>{tx('返回修改', 'Edit dates')}</ActionButton></View>
              <View style={styles.actionGrow}><ActionButton busy={busy} onPress={() => void submitItem(true)}>{tx('调整并加入', 'Extend and add')}</ActionButton></View>
            </View>
          </View>
        ) : null}
        {confirmDeleteItem && editingItem ? (
          <View style={[styles.deleteConfirm, { borderTopColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold">{tx(`删除“${editingItem.title}”？`, `Delete “${editingItem.title}”?`)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{tx('此操作无法恢复。', 'This cannot be undone.')}</ThemedText>
            <View style={styles.formActions}>
              <View style={styles.actionGrow}><ActionButton tone="secondary" onPress={() => setConfirmDeleteItem(false)}>{tx('保留', 'Keep')}</ActionButton></View>
              <View style={styles.actionGrow}><Pressable accessibilityRole="button" disabled={busy} onPress={() => void deleteSelectedItem()} style={({ pressed }) => [styles.dangerConfirm, { backgroundColor: theme.danger }, pressed && styles.pressed, busy && styles.disabled]}><ThemedText type="smallBold" style={{ color: theme.textOnAccent }}>{busy ? tx('删除中…', 'Deleting…') : tx('删除', 'Delete')}</ThemedText></Pressable></View>
            </View>
          </View>
        ) : !pendingTripRange ? (
          <ActionButton busy={busy} disabled={!title.trim() || (kind === 'lodging' && !location.trim())} onPress={() => void submitItem()}>{editingItem ? tx('保存', 'Save') : tx('加入行程', 'Add')}</ActionButton>
        ) : null}
        {formError ? <InlineNotice tone="error">{formError}</InlineNotice> : null}
      </View>
    </BottomSheet>
  );
}

function DestinationSettings({
  currency,
  currencyOptions,
  destination,
  open,
  timeZone,
  timeZoneOptions,
  onCurrencyChange,
  onTimeZoneChange,
  onToggle,
  tx,
}: {
  currency: string;
  currencyOptions: { label: string; value: string }[];
  destination: ItineraryDestination;
  open: boolean;
  timeZone: string;
  timeZoneOptions: { label: string; value: string }[];
  onCurrencyChange: (value: string) => void;
  onTimeZoneChange: (value: string) => void;
  onToggle: () => void;
  tx: (zh: string, en: string) => string;
}) {
  const theme = useTheme();
  const resolvedCurrencyOptions = currencyOptions.some((option) => option.value === currency)
    ? currencyOptions
    : [{ value: currency, label: currency }, ...currencyOptions];
  const resolvedTimeZoneOptions = timeZoneOptions.some((option) => option.value === timeZone)
    ? timeZoneOptions
    : [{ value: timeZone, label: timeZone }, ...timeZoneOptions];
  return (
    <View style={styles.destinationSettings}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        style={({ pressed }) => [styles.destinationSummary, pressed && styles.pressed]}>
        <View style={styles.destinationSummaryCopy}>
          <ThemedText type="smallBold">{tx('已自动设置', 'Smart defaults')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {destination.cityName} · {timeZone} · {currency} · {tx('点按调整', 'tap to adjust')}
          </ThemedText>
        </View>
        <Chevron color={theme.textSecondary} direction={open ? 'down' : 'right'} />
      </Pressable>
      {open ? (
        <View style={[styles.destinationSettingsRow, { backgroundColor: theme.backgroundSubtle }]}>
          <View style={styles.destinationSettingGrow}><SelectionField label={tx('安排时区', 'Plan time zone')} value={timeZone} options={resolvedTimeZoneOptions} onChange={onTimeZoneChange} /></View>
          <View style={styles.destinationSettingGrow}><SelectionField label={tx('当地币种', 'Local currency')} value={currency} options={resolvedCurrencyOptions} onChange={onCurrencyChange} /></View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { width: '100%', gap: 14 },
  kindChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rangeConfirm: { gap: 10 },
  dateTimeRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'stretch', gap: Spacing.sm },
  formActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionGrow: { flexGrow: 1, flexBasis: 150 },
  deleteTrigger: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  lockedDestination: { borderRadius: 12, padding: 14, gap: 3 },
  destinationSettings: { gap: 8 },
  destinationSummary: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 },
  destinationSummaryCopy: { flex: 1, gap: 1 },
  destinationSettingsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 12, borderRadius: 14 },
  destinationSettingGrow: { flexGrow: 1, flexBasis: 180 },
  deleteConfirm: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14, gap: 10 },
  dangerConfirm: { minHeight: 48, borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center' },
  pressed: { opacity: 0.68 },
  disabled: { opacity: 0.5 },
});
