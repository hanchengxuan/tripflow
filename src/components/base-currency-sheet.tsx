import { StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { ActionButton, FormField, InlineNotice } from '@/components/form-controls';
import { SelectionField } from '@/components/selection-field';
import { SettingsDivider, SettingsGroup, SettingsRow } from '@/components/settings-list';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/**
 * The ledger's base currency, and restating the books in a different one.
 *
 * Spending in several currencies on one trip is ordinary and always worked:
 * every expense records what was actually paid, in its own currency. This
 * setting is only the unit those are summed and settled in — and an earlier
 * version of this panel refused to change it and told the reader to start a new
 * trip, which read as though the product allowed one currency per trip. It does
 * not, and never did.
 *
 * Changing the base restates every expense's conversion. That is real work and
 * it needs a rate per currency spent, so it is asked for rather than guessed.
 * Two things make it safe rather than dangerous: what was actually paid is
 * never rewritten, so the restatement can be redone or undone; and a run that
 * stops halfway is detected and resumed.
 *
 * Recorded settlements are the one hard stop. Money that has actually moved
 * between two people is a fact, and restating the unit the books are kept in
 * cannot change what was transferred.
 */
export function BaseCurrencySheet({
  busy,
  currency,
  currencyOptions,
  draft,
  error,
  expenseCount,
  currenciesSpent,
  needRates,
  onChangeDraft,
  onChangeRate,
  onDismiss,
  onSubmit,
  pendingCount,
  rates,
  settlementCount,
  tx,
  visible,
}: {
  busy: boolean;
  currency: string;
  currencyOptions: { label: string; value: string }[];
  draft: string;
  error?: string;
  expenseCount: number;
  /** How many distinct currencies have actually been spent on this trip. */
  currenciesSpent: number;
  /** Currencies the restatement needs a rate for. */
  needRates: string[];
  onChangeDraft: (value: string) => void;
  onChangeRate: (currency: string, value: string) => void;
  onDismiss: () => void;
  onSubmit: () => void;
  /** Expenses a previous, interrupted run left in the old base. */
  pendingCount: number;
  rates: Record<string, string>;
  settlementCount: number;
  tx: (zh: string, en: string) => string;
  visible: boolean;
}) {
  const options = currencyOptions.some((option) => option.value === currency)
    ? currencyOptions
    : [{ value: currency, label: currency }, ...currencyOptions];
  const settled = settlementCount > 0;
  const changing = draft.toUpperCase() !== currency.toUpperCase();
  const ratesReady = needRates.every((code) => Number(rates[code]) > 0);

  return (
    <BottomSheet onDismiss={onDismiss} title={tx('记账币种', 'Ledger currency')} visible={visible}>
      <View style={styles.body}>
        {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}

        {/* Said first, because the old copy implied the opposite. */}
        <ThemedText type="small" themeColor="textSecondary">
          {tx('支出可以用任何币种记录 —— 记一笔时选币种就行，付了多少就存多少。这里设的只是汇总和结算用的单位。',
              'Record an expense in any currency you like — what you paid is kept exactly as you paid it. This setting is only the unit everything is summed and settled in.')}
        </ThemedText>

        <SettingsGroup>
          <SettingsRow label={tx('当前记账币种', 'Ledger currency')} value={currency} />
          <SettingsDivider />
          <SettingsRow
            label={tx('已记录支出', 'Expenses recorded')}
            value={currenciesSpent > 1
              ? tx(`${expenseCount} 笔 · ${currenciesSpent} 种币种`, `${expenseCount} in ${currenciesSpent} currencies`)
              : tx(`${expenseCount} 笔`, `${expenseCount}`)}
          />
        </SettingsGroup>

        {pendingCount > 0 ? (
          <InlineNotice tone="error">
            {tx(`上一次换算没有做完：还有 ${pendingCount} 笔支出记在旧币种上。再执行一次即可补齐，已经换好的不会被重复处理。`,
                `A previous restatement did not finish: ${pendingCount} expense${pendingCount === 1 ? '' : 's'} still sit in the old currency. Run it again to finish; what already converted is left alone.`)}
          </InlineNotice>
        ) : null}

        {settled ? (
          <InlineNotice>
            {tx(`这个行程已经有 ${settlementCount} 笔转账记录。钱已经实际转过了，改记账币种并不能改变已经付出去的金额，所以这里不再变更。新的支出仍然可以用任何币种记录。`,
                `This trip has ${settlementCount} recorded transfer${settlementCount === 1 ? '' : 's'}. That money has actually moved, and restating the unit the books are kept in cannot change what was paid — so the base stays put. New expenses can still be in any currency.`)}
          </InlineNotice>
        ) : (
          <>
            <SelectionField
              label={tx('记账币种', 'Ledger currency')}
              value={draft}
              options={options}
              onChange={onChangeDraft}
            />

            {changing && needRates.length > 0 ? (
              <View style={styles.rates}>
                <ThemedText type="small" themeColor="textSecondary">
                  {tx(`这 ${expenseCount} 笔支出会按下面的汇率重新计价。付出去的金额不变，只是换个单位来汇总。`,
                      `The ${expenseCount} recorded expense${expenseCount === 1 ? '' : 's'} will be restated at these rates. What was paid does not change — only the unit it is summed in.`)}
                </ThemedText>
                {needRates.map((code) => (
                  <FormField
                    key={code}
                    label={tx(`1 ${code} = ? ${draft.toUpperCase()}`, `1 ${code} = ? ${draft.toUpperCase()}`)}
                    value={rates[code] ?? ''}
                    onChangeText={(value) => onChangeRate(code, value)}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                  />
                ))}
              </View>
            ) : null}

            <ActionButton
              busy={busy}
              disabled={(!changing && pendingCount === 0) || (changing && !ratesReady)}
              onPress={onSubmit}>
              {expenseCount > 0
                ? tx('换算并保存', 'Restate and save')
                : tx('保存', 'Save')}
            </ActionButton>
          </>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { width: '100%', gap: Spacing.sm },
  rates: { gap: Spacing.sm },
});
