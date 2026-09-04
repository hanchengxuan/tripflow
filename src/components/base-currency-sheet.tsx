import { StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { ActionButton, InlineNotice } from '@/components/form-controls';
import { SelectionField } from '@/components/selection-field';
import { SettingsDivider, SettingsGroup, SettingsRow } from '@/components/settings-list';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { canChangeBaseCurrency } from '@/features/trips/trip-defaults';

/**
 * The ledger's base currency.
 *
 * It used to be a field on the Trips form called 记账币种, sitting between a
 * trip's name and its dates, changeable at any moment. It is not a property of
 * the trip: `record_expense` validates every expense against it and stores a
 * `base_amount_minor` converted at the rate of the day, and balances, transfers
 * and settlements are all denominated in it.
 *
 * `update_trip_details` recomputes none of that. Changing the base after money
 * has been recorded would leave every stored base amount converted against the
 * old currency while the ledger sums and settles them as the new one — silently
 * wrong arithmetic, three taps away. So once an expense exists the row states
 * the currency and why it is fixed, rather than offering a control that breaks
 * the books.
 */
export function BaseCurrencySheet({
  busy,
  currency,
  currencyOptions,
  draft,
  error,
  expenseCount,
  onChangeDraft,
  onDismiss,
  onSubmit,
  tx,
  visible,
}: {
  busy: boolean;
  currency: string;
  currencyOptions: { label: string; value: string }[];
  draft: string;
  error?: string;
  expenseCount: number;
  onChangeDraft: (value: string) => void;
  onDismiss: () => void;
  onSubmit: () => void;
  tx: (zh: string, en: string) => string;
  visible: boolean;
}) {
  const changeable = canChangeBaseCurrency(expenseCount);
  const options = currencyOptions.some((option) => option.value === currency)
    ? currencyOptions
    : [{ value: currency, label: currency }, ...currencyOptions];

  return (
    <BottomSheet onDismiss={onDismiss} title={tx('记账币种', 'Ledger currency')} visible={visible}>
      <View style={styles.body}>
        {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
        <ThemedText type="small" themeColor="textSecondary">
          {changeable
            ? tx('所有余额、结算和「已换算」金额都记在这个币种里。记下第一笔支出之后就不能再改。',
                 'Balances, settlements and every converted amount are kept in this currency. It is fixed once the first expense is recorded.')
            : tx('所有余额、结算和「已换算」金额都记在这个币种里。外币支出按当时的汇率折算成它。',
                 'Balances, settlements and every converted amount are kept in this currency. Foreign-currency expenses are converted into it at the rate of the day.')}
        </ThemedText>

        {changeable ? (
          <>
            <SelectionField
              label={tx('记账币种', 'Ledger currency')}
              value={draft}
              options={options}
              onChange={onChangeDraft}
            />
            <ActionButton busy={busy} disabled={!draft || draft === currency} onPress={onSubmit}>
              {tx('保存', 'Save')}
            </ActionButton>
          </>
        ) : (
          <>
            <SettingsGroup>
              <SettingsRow label={tx('当前记账币种', 'Ledger currency')} value={currency} />
              <SettingsDivider />
              <SettingsRow label={tx('已记录支出', 'Expenses recorded')} value={tx(`${expenseCount} 笔`, `${expenseCount}`)} />
            </SettingsGroup>
            <InlineNotice>
              {tx(`已经有 ${expenseCount} 笔支出记在 ${currency} 里，币种不能再改 —— 改了这些金额的折算依据就对不上了。需要换币种的话，新建一个行程。`,
                  `${expenseCount} expense${expenseCount === 1 ? '' : 's'} ${expenseCount === 1 ? 'is' : 'are'} already recorded in ${currency}, so it can no longer change — the conversions behind those amounts would stop adding up. Start a new trip to keep a ledger in another currency.`)}
            </InlineNotice>
          </>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { width: '100%', gap: Spacing.sm },
});
