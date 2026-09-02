import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { DateTimeField } from '@/components/date-time-field';
import { DestinationField } from '@/components/destination-field';
import { DestinationSettings } from '@/components/destination-settings';
import { ActionButton, FormField, InlineNotice } from '@/components/form-controls';
import { Spacing } from '@/constants/theme';
import { destinationLabel, type DestinationSuggestion } from '@/features/destinations/destination-search';

export interface TripDraft {
  name: string;
  startsOn: string;
  endsOn: string;
  currency: string;
  timeZone: string;
  destinationText: string;
  settingsOpen: boolean;
}

/**
 * Creating a trip, and editing one.
 *
 * Name, dates, and where you are going. Time zone and currency used to be two
 * pickers of equal weight, which asked every traveller to answer a question
 * about IANA zone names before they could create a trip. Choosing a destination
 * sets both; the summary row underneath keeps them visible and correctable
 * without putting them in the way.
 *
 * The form used to unfold inside the Trips page under a button that renamed
 * itself to 收起. It is a sheet now, like every other form in the product.
 */
export function TripFormSheet({
  busy,
  currencyOptions,
  draft,
  error,
  mode,
  onChange,
  onDismiss,
  onSubmit,
  timeZoneOptions,
  tx,
  visible,
}: {
  busy: boolean;
  currencyOptions: { label: string; value: string }[];
  draft: TripDraft;
  error?: string;
  mode: 'create' | 'edit';
  onChange: (patch: Partial<TripDraft>) => void;
  onDismiss: () => void;
  onSubmit: () => void;
  timeZoneOptions: { label: string; value: string }[];
  tx: (zh: string, en: string) => string;
  visible: boolean;
}) {
  const { width } = useWindowDimensions();
  const compact = width < 520;

  function chooseDestination(suggestion: DestinationSuggestion) {
    onChange({
      destinationText: destinationLabel(suggestion),
      timeZone: suggestion.timeZone,
      ...(suggestion.currency ? { currency: suggestion.currency } : {}),
    });
  }

  return (
    <BottomSheet
      onDismiss={onDismiss}
      title={mode === 'create' ? tx('新建行程', 'New trip') : tx('编辑行程资料', 'Edit trip details')}
      visible={visible}
    >
      <View style={styles.form}>
        {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
        <FormField
          label={tx('行程名称', 'Trip name')}
          value={draft.name}
          onChangeText={(name) => onChange({ name })}
          placeholder={tx('例如：北海道滑雪之旅', 'For example: Hokkaido ski trip')}
        />
        <DestinationField
          value={draft.destinationText}
          planTitle={draft.name}
          onChange={(destinationText) => onChange({ destinationText })}
          onSelect={chooseDestination}
        />
        <View style={[styles.row, compact && styles.rowStacked]}>
          <View style={[styles.field, compact && styles.fieldStacked]}>
            <DateTimeField label={tx('开始日期', 'Start date')} value={draft.startsOn} mode="date" onChange={(startsOn) => onChange({ startsOn })} />
          </View>
          <View style={[styles.field, compact && styles.fieldStacked]}>
            <DateTimeField
              label={tx('结束日期', 'End date')}
              value={draft.endsOn}
              mode="date"
              minimumDate={new Date(`${draft.startsOn}T12:00:00`)}
              onChange={(endsOn) => onChange({ endsOn })}
            />
          </View>
        </View>
        <DestinationSettings
          currency={draft.currency}
          currencyOptions={currencyOptions}
          onCurrencyChange={(currency) => onChange({ currency })}
          onTimeZoneChange={(timeZone) => onChange({ timeZone })}
          onToggle={() => onChange({ settingsOpen: !draft.settingsOpen })}
          open={draft.settingsOpen}
          timeZone={draft.timeZone}
          timeZoneOptions={timeZoneOptions}
          tx={tx}
        />
        <ActionButton busy={busy} disabled={!draft.name.trim()} onPress={onSubmit}>
          {mode === 'create' ? tx('创建并进入行程', 'Create and open trip') : tx('保存行程', 'Save trip')}
        </ActionButton>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: { width: '100%', gap: Spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  rowStacked: { flexDirection: 'column' },
  field: { flexGrow: 1, flexBasis: 220 },
  fieldStacked: { flexGrow: 0, flexBasis: 'auto' },
});
