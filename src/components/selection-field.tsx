import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Chevron } from '@/components/chevron';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/features/i18n/i18n-provider';

export interface SelectionOption<T extends string> {
  value: T;
  label: string;
}

export function SelectionField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly SelectionOption<T>[];
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  const { tx } = useI18n();
  const [open, setOpen] = useState(false);
  const selectedLabel = useMemo(
    () => options.find((option) => option.value === value)?.label ?? value,
    [options, value],
  );

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}：${selectedLabel}`}
        onPress={() => setOpen(true)}
        style={[styles.control, { backgroundColor: theme.backgroundElement, borderColor: theme.borderField }]}
      >
        <ThemedText>{selectedLabel}</ThemedText>
        <Chevron color={theme.textSecondary} />
      </Pressable>
      <Modal transparent visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={[styles.backdrop, { backgroundColor: theme.scrim }]} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.backgroundElement }]}
            onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <ThemedText type="smallBold">{label}</ThemedText>
              <Pressable accessibilityRole="button" onPress={() => setOpen(false)}>
                <ThemedText type="link">{tx('完成', 'Done')}</ThemedText>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.optionList}>
              {options.map((option) => {
                const selected = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected, selected }}
                    onPress={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    style={[
                      styles.option,
                      { borderColor: theme.borderField },
                      selected && { borderColor: theme.accent, backgroundColor: theme.accentSoft },
                    ]}>
                    <ThemedText type={selected ? 'smallBold' : 'default'}>{option.label}</ThemedText>
                    {selected ? <ThemedText style={{ color: theme.accentOnSoft }}>✓</ThemedText> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  control: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '72%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 12 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  optionList: { gap: 8, paddingBottom: 24 },
  option: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
