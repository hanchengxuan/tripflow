import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { DateTimeField } from '@/components/date-time-field';
import { DestinationField } from '@/components/destination-field';
import { DestinationSummary } from '@/components/destination-settings';
import { ActionButton, FormField, InlineNotice } from '@/components/form-controls';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { destinationLabel, type DestinationSuggestion } from '@/features/destinations/destination-search';

export interface TripDraft {
  name: string;
  startsOn: string;
  endsOn: string;
  destinationText: string;
  /** Derived from the destination, never chosen. Blank until one is picked. */
  timeZone?: string;
}

/**
 * Creating a trip, and editing one.
 *
 * Name, where you are going, dates. Nothing else.
 *
 * A time zone and a currency used to sit behind a 「已自动设置」 disclosure here.
 * The zone is derived from the destination — the app can answer that question
 * without asking it — and the currency was the ledger's base, which belongs to
 * the ledger and is set there, where changing it can be refused once money has
 * been recorded against it.
 */
export function TripFormSheet({
  busy,
  draft,
  error,
  mode,
  onChange,
  onDismiss,
  onSubmit,
  tx,
  visible,
}: {
  busy: boolean;
  draft: TripDraft;
  error?: string;
  mode: 'create' | 'edit';
  onChange: (patch: Partial<TripDraft>) => void;
  onDismiss: () => void;
  onSubmit: () => void;
  tx: (zh: string, en: string) => string;
  visible: boolean;
}) {
  const { width } = useWindowDimensions();
  const compact = width < 520;

  function chooseDestination(suggestion: DestinationSuggestion) {
    onChange({ destinationText: destinationLabel(suggestion), timeZone: suggestion.timeZone });
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
        <DestinationSummary timeZone={draft.timeZone} tx={tx} />
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
        <ActionButton busy={busy} disabled={!draft.name.trim()} onPress={onSubmit}>
          {mode === 'create' ? tx('创建并进入行程', 'Create and open trip') : tx('保存行程', 'Save trip')}
        </ActionButton>
        {mode === 'create' ? (
          <ThemedText type="small" themeColor="textSecondary">
            {tx('记账币种在账本里设置，第一笔支出记下之后就固定了。',
                'The ledger currency is set in the Ledger, and fixed once the first expense is recorded.')}
          </ThemedText>
        ) : null}
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
