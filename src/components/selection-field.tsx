import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

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
        style={[styles.control, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
        <ThemedText>{selectedLabel}</ThemedText>
        <ThemedText themeColor="textSecondary">选择 ›</ThemedText>
      </Pressable>
      <Modal transparent visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.backgroundElement }]}
            onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <ThemedText type="smallBold">{label}</ThemedText>
              <Pressable accessibilityRole="button" onPress={() => setOpen(false)}>
                <ThemedText type="link">完成</ThemedText>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.optionList}>
              {options.map((option) => {
                const selected = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    style={[
                      styles.option,
                      { borderColor: theme.backgroundSelected },
                      selected && styles.optionSelected,
                    ]}>
                    <ThemedText type={selected ? 'smallBold' : 'default'}>{option.label}</ThemedText>
                    {selected ? <ThemedText style={styles.check}>✓</ThemedText> : null}
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.42)', justifyContent: 'flex-end' },
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
  optionSelected: { borderColor: '#0F9D7A', backgroundColor: '#DDEBE5' },
  check: { color: '#0F9D7A' },
});
