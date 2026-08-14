import { StyleSheet, View } from 'react-native';

import { ActionButton, InlineNotice } from '@/components/form-controls';
import { InfoCard } from '@/components/info-card';
import { SelectionField, type SelectionOption } from '@/components/selection-field';
import { ThemedText } from '@/components/themed-text';
import type { ItineraryItem } from '@/domain/models';
import { useI18n } from '@/features/i18n/i18n-provider';

export function MoveItineraryCard({
  item,
  targetTripId,
  targetTripOptions,
  busy,
  error,
  onTargetTripChange,
  onCancel,
  onMove,
}: {
  item: ItineraryItem;
  targetTripId: string;
  targetTripOptions: readonly SelectionOption<string>[];
  busy: boolean;
  error?: string;
  onTargetTripChange: (tripId: string) => void;
  onCancel: () => void;
  onMove: () => void;
}) {
  const { tx } = useI18n();

  return (
    <InfoCard label={tx('移动安排', 'Move plan')} title={item.title} accent="#D86E35">
      <View style={styles.content}>
        <SelectionField
          label={tx('目标行程', 'Move to')}
          value={targetTripId}
          options={targetTripOptions}
          onChange={onTargetTripChange}
        />
        <ThemedText type="small" themeColor="textSecondary">
          {tx('时间、地点和路线会保留；关联的酒店交通和记账会一并移动。', 'Time, place, and route stay intact. Linked hotel transfer and expenses move with it.')}
        </ThemedText>
        <View style={styles.actions}>
          <View style={styles.actionGrow}>
            <ActionButton tone="secondary" onPress={onCancel}>{tx('取消', 'Cancel')}</ActionButton>
          </View>
          <View style={styles.actionGrow}>
            <ActionButton busy={busy} disabled={!targetTripId} onPress={onMove}>{tx('确认移动', 'Move plan')}</ActionButton>
          </View>
        </View>
        {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
      </View>
    </InfoCard>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionGrow: { flexGrow: 1, flexBasis: 150 },
});
