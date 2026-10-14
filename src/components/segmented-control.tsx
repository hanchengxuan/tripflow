import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Size, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function SegmentedControl<T extends string>({
  onChange,
  options,
  value,
}: {
  onChange: (value: T) => void;
  options: readonly { label: string; value: T }[];
  value: T;
}) {
  const theme = useTheme();
  return (
    <View accessibilityRole="tablist" style={[styles.track, { backgroundColor: theme.backgroundSubtle }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            aria-selected={selected}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.option,
              selected && { backgroundColor: theme.backgroundElement, shadowColor: theme.shadow },
              pressed && styles.pressed,
            ]}>
            <ThemedText style={[styles.label, { color: selected ? theme.text : theme.textSecondary }, selected && styles.labelSelected]}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', maxWidth: '100%', borderRadius: Radius.pill, padding: Spacing['2xs'] },
  option: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 'auto',
    minWidth: Size.touchMin * 2,
    minHeight: Size.touchMin,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
  },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '500' },
  labelSelected: { fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
