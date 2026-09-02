import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Size, Spacing } from '@/constants/theme';
import type { Segment } from '@/domain/models';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useTheme } from '@/hooks/use-theme';

const SEARCH_HEIGHT = 40;
const GLASS_SIZE = 16;

/**
 * Finding a plan, in one row.
 *
 * The search box carries its own label in the placeholder rather than stacking
 * a field label above it, and branches are a filter here instead of a list
 * above the rail: both used to push the first plan below the fold. Selecting a
 * branch narrows the rail, so the count beside it is what the filter would
 * show, not a running total.
 */
export function PlanFilterBar({
  branchCounts,
  onManageBranches,
  onQueryChange,
  onSelectSegment,
  query,
  segments,
  selectedSegmentId,
}: {
  branchCounts: Map<string, number>;
  onManageBranches?: () => void;
  onQueryChange: (value: string) => void;
  onSelectSegment: (segmentId: string | undefined) => void;
  query: string;
  segments: Segment[];
  selectedSegmentId?: string;
}) {
  const theme = useTheme();
  const { tx } = useI18n();

  return (
    <View style={styles.wrap}>
      <View style={[styles.search, { backgroundColor: theme.backgroundSubtle }]}>
        <SearchGlass color={theme.textMuted} />
        <TextInput
          accessibilityLabel={tx('查找安排', 'Find a plan')}
          autoCorrect={false}
          onChangeText={onQueryChange}
          placeholder={tx('搜索标题、地点或目的地', 'Search titles, places, or destinations')}
          placeholderTextColor={theme.textMuted}
          style={[styles.searchInput, { color: theme.text }]}
          value={query}
        />
      </View>

      {segments.length > 0 ? (
        <View style={styles.filters}>
          <FilterChip
            label={tx('全部', 'All')}
            onPress={() => onSelectSegment(undefined)}
            selected={!selectedSegmentId}
          />
          {segments.map((segment) => (
            <FilterChip
              key={segment.id}
              label={`${segment.name} ${branchCounts.get(segment.id) ?? 0}`}
              onPress={() => onSelectSegment(segment.id === selectedSegmentId ? undefined : segment.id)}
              selected={segment.id === selectedSegmentId}
            />
          ))}
          {onManageBranches ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={6}
              onPress={onManageBranches}
              style={({ pressed }) => [styles.manage, pressed && styles.pressed]}>
              <ThemedText type="smallBold" themeColor="link">{tx('管理分支', 'Manage')}</ThemedText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function FilterChip({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: selected ? theme.accent : theme.backgroundSubtle },
        pressed && styles.pressed,
      ]}>
      <ThemedText
        type="small"
        style={[styles.chipLabel, { color: selected ? theme.textOnAccent : theme.text, fontWeight: selected ? '600' : '500' }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function SearchGlass({ color }: { color: string }) {
  return (
    <View accessibilityElementsHidden style={styles.glass}>
      <View style={[styles.glassRing, { borderColor: color }]} />
      <View style={[styles.glassHandle, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs + 2 },
  search: {
    height: SEARCH_HEIGHT,
    borderRadius: Radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  searchInput: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 20, fontWeight: '500', paddingVertical: 0 },
  glass: { width: GLASS_SIZE, height: GLASS_SIZE, alignItems: 'center', justifyContent: 'center' },
  glassRing: { width: 11, height: 11, borderRadius: Radius.pill, borderWidth: 1.6, position: 'absolute', top: 1, left: 1 },
  glassHandle: { width: 1.6, height: 5, borderRadius: 1, position: 'absolute', right: 1.5, bottom: 1, transform: [{ rotate: '-45deg' }] },
  filters: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.xs },
  chip: { height: 36, borderRadius: Radius.pill, paddingHorizontal: 14, justifyContent: 'center' },
  chipLabel: { lineHeight: 18 },
  manage: { minHeight: Size.touchMin, justifyContent: 'center', paddingHorizontal: Spacing['2xs'], marginLeft: 'auto' },
  pressed: { opacity: 0.68 },
});
