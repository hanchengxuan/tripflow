import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { Chevron } from '@/components/chevron';
import { DateTimePairField } from '@/components/date-time-pair-field';
import { DestinationField } from '@/components/destination-field';
import { DestinationSettings } from '@/components/destination-settings';
import { ActionButton, ChoiceChip, FormField, InlineNotice } from '@/components/form-controls';
import { ItineraryEditAssistant } from '@/components/itinerary-edit-assistant';
import { ListDivider, ListRow, ListSurface } from '@/components/list-surface';
import { LocationField } from '@/components/location-field';
import { ThemedText } from '@/components/themed-text';
import { getCurrencyOptions, getTimeZoneOptions, itineraryKindLabels, itineraryKindLabelsEn, itineraryKinds } from '@/constants/options';
import { Radius, Spacing } from '@/constants/theme';
import type { ItineraryDestination, ItineraryItem, ItineraryKind, Trip } from '@/domain/models';
import { destinationLabel, type DestinationSuggestion } from '@/features/destinations/destination-search';
import { useI18n } from '@/features/i18n/i18n-provider';
import { toUserMessage } from '@/lib/user-error';
import { formatDayRange, formatZonedDateTimeRange, isoToZonedDateTime, zonedDateTimeToIso } from '@/lib/trip-time';
import { useTheme } from '@/hooks/use-theme';

export interface ItineraryComposerSheetProps {
  activeTrip: Trip;
  editingItem?: ItineraryItem;
  itineraryItems: ItineraryItem[];
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
  /** Opens the branch sheet for this plan. Absent when branching does not apply. */
  onSplitFromHere?: () => void;
  visible: boolean;
}

export function ItineraryComposerSheet({
  activeTrip,
  editingItem,
  itineraryItems,
  onAdd,
  onDelete,
  onDismiss,
  onExtendTrip,
  onSave,
  onSuccess,
  onSplitFromHere,
  visible,
}: ItineraryComposerSheetProps) {
  const { locale, languageTag, tx } = useI18n();
  const theme = useTheme();
  // Web's native date/time inputs render a full dd/mm/yyyy and a localized
  // clock at a fixed size and cannot shrink, so two pairs side by side clip
  // the year and the minutes at every width the sheet actually reaches. Native
  // keeps the designed side-by-side row, where the formatted text is compact.
  const stackDates = Platform.OS === 'web';
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

  // Confirming a deletion takes over the panel rather than swapping the footer
  // underneath the form. The old shape put the confirmation where 保存 had
  // been, so edits already typed had no way out; here 取消 restores the form
  // with every field intact, and the destructive action is prominent with
  // 取消 below it and separated.
  if (confirmDeleteItem && editingItem) {
    const when = formatZonedDateTimeRange(
      editingItem.startsAt,
      editingItem.endsAt,
      languageTag,
      editingItem.destination?.timeZone ?? activeTrip.defaultTimeZone,
    );
    const where = editingItem.destination?.cityName ?? editingItem.locationLabel;
    return (
      <BottomSheet
        closeLabel={tx('返回', 'Back')}
        onDismiss={() => setConfirmDeleteItem(false)}
        title={tx(`删除“${editingItem.title}”？`, `Delete “${editingItem.title}”?`)}
        visible={visible}
      >
        <View style={styles.form}>
          <ThemedText type="small" themeColor="textSecondary">
            {[when, where].filter(Boolean).join(' · ')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {tx('此操作无法恢复，同行的人也会看到这项安排消失。', 'This cannot be undone, and everyone on the trip will see it disappear.')}
          </ThemedText>
          <ActionButton tone="danger" busy={busy} onPress={() => void deleteSelectedItem()}>
            {tx('删除这项安排', 'Delete this plan')}
          </ActionButton>
          <View style={[styles.confirmRule, { backgroundColor: theme.border }]} />
          <ActionButton tone="secondary" disabled={busy} onPress={() => setConfirmDeleteItem(false)}>
            {tx('取消', 'Cancel')}
          </ActionButton>
          {formError ? <InlineNotice tone="error">{formError}</InlineNotice> : null}
        </View>
      </BottomSheet>
    );
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
                placeLabel={destination.cityName}
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
            stacked
          />
        ) : kind === 'lodging' ? (
          <View style={[styles.dateTimeRow, stackDates && styles.dateTimeRowStacked]}>
            <DateTimePairField label={tx('入住', 'Check-in')} dateLabel={tx('入住日期', 'Check-in date')} dateValue={date} timeLabel={tx('入住时间', 'Check-in time')} timeValue={startTime} onDateChange={updatePlanDate} onTimeChange={setStartTime} stacked={stackDates} />
            <DateTimePairField label={tx('退房', 'Check-out')} dateLabel={tx('退房日期', 'Check-out date')} dateValue={endDate} timeLabel={tx('退房时间', 'Check-out time')} timeValue={endTime} onDateChange={updatePlanEndDate} onTimeChange={setEndTime} stacked={stackDates} />
          </View>
        ) : (
          <View style={[styles.dateTimeRow, stackDates && styles.dateTimeRowStacked]}>
            <DateTimePairField label={tx('开始', 'Start')} dateLabel={tx('开始日期', 'Start date')} dateValue={date} timeLabel={tx('开始时间', 'Start time')} timeValue={startTime} onDateChange={updatePlanDate} onTimeChange={setStartTime} stacked={stackDates} />
            <DateTimePairField label={tx('结束', 'End')} dateLabel={tx('结束日期', 'End date')} dateValue={endDate} timeLabel={tx('结束时间', 'End time')} timeValue={endTime} onDateChange={updatePlanEndDate} onTimeChange={setEndTime} stacked={stackDates} />
          </View>
        )}
        {editingItem ? (
          <ItineraryEditAssistant
            key={editingItem.id}
            trip={activeTrip}
            item={editingItem}
            items={itineraryItems}
            onApply={async (candidate) => {
              await onSave({
                itemId: candidate.id,
                title: candidate.title,
                locationLabel: candidate.locationLabel,
                googlePlaceId: candidate.googlePlaceId,
                destination: candidate.destination,
                startsAt: candidate.startsAt,
                endsAt: candidate.endsAt,
              });
              const nextTimeZone = candidate.destination?.timeZone ?? activeTrip.defaultTimeZone;
              const start = isoToZonedDateTime(candidate.startsAt, nextTimeZone);
              const end = isoToZonedDateTime(candidate.endsAt, nextTimeZone);
              setTitle(candidate.title);
              setLocation(candidate.locationLabel ?? '');
              setGooglePlaceId(candidate.googlePlaceId ?? '');
              setDestination(candidate.destination);
              setDestinationText(candidate.destination ? destinationLabel(candidate.destination) : '');
              setItemTimeZone(nextTimeZone);
              setItemCurrency(candidate.destination?.currency ?? activeTrip.homeCurrency);
              setDate(start.date);
              setStartTime(start.time);
              setEndDate(end.date);
              setEndTime(end.time);
            }}
          />
        ) : null}
        {/* The per-plan actions are rows, not centred links in a form whose
            every other control is left-aligned and full width. Each carries
            the chevron that says it opens a panel. */}
        {editingItem ? (
          <ListSurface tone="subtle">
            {onSplitFromHere ? (
              <>
                <ListRow
                  title={tx('从这里分开走', 'Split off from here')}
                  onPress={onSplitFromHere}
                  trailing={<Chevron color={theme.textMuted} />}
                />
                <ListDivider />
              </>
            ) : null}
            <ListRow
              title={tx('删除这项安排', 'Delete this plan')}
              titleColor="danger"
              onPress={() => setConfirmDeleteItem(true)}
              trailing={<Chevron color={theme.danger} />}
            />
          </ListSurface>
        ) : null}
        {pendingTripRange ? (
          <View style={styles.rangeConfirm}>
            {/* Stated as a localized range, the way Trips and the branch sheet
                state one — not as two raw ISO dates. */}
            <InlineNotice>{tx(`这项安排超出当前行程。要把行程调整为 ${formatDayRange(pendingTripRange.startsOn, pendingTripRange.endsOn, languageTag)} 吗？`, `This plan is outside the current trip. Extend it to ${formatDayRange(pendingTripRange.startsOn, pendingTripRange.endsOn, languageTag)}?`)}</InlineNotice>
            <View style={styles.formActions}>
              <View style={styles.actionGrow}><ActionButton tone="secondary" onPress={() => setPendingTripRange(undefined)}>{tx('返回修改', 'Edit dates')}</ActionButton></View>
              <View style={styles.actionGrow}><ActionButton busy={busy} onPress={() => void submitItem(true)}>{tx('调整并加入', 'Extend and add')}</ActionButton></View>
            </View>
          </View>
        ) : null}
        {/* Nothing on this panel takes 保存 away. */}
        {!pendingTripRange ? (
          <ActionButton busy={busy} disabled={!title.trim() || (kind === 'lodging' && !location.trim())} onPress={() => void submitItem()}>{editingItem ? tx('保存', 'Save') : tx('加入行程', 'Add')}</ActionButton>
        ) : null}
        {formError ? <InlineNotice tone="error">{formError}</InlineNotice> : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: { width: '100%', gap: 14 },
  kindChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rangeConfirm: { gap: 10 },
  dateTimeRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'stretch', gap: Spacing.sm },
  dateTimeRowStacked: { flexDirection: 'column' },
  formActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionGrow: { flexGrow: 1, flexBasis: 150 },
  lockedDestination: { borderRadius: Radius.sm, padding: 14, gap: 3 },
  confirmRule: { height: StyleSheet.hairlineWidth },
});
