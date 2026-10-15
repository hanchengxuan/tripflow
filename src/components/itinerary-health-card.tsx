import { Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { ActionButton, InlineNotice } from '@/components/form-controls';
import { HealthFixSuggestion } from '@/components/health-fix-suggestion';
import { ThemedText } from '@/components/themed-text';
import { Spacing, Radius } from '@/constants/theme';
import type { ItineraryItem, Trip } from '@/domain/models';
import { suggestHealthFix, type HealthFix } from '@/features/ai/itinerary-health-fix';
import { useI18n } from '@/features/i18n/i18n-provider';
import type { ItineraryHealthIssue } from '@/features/ai/itinerary-health';
import type { ItineraryHealth } from '@/features/ai/use-itinerary-health';
import { useTheme } from '@/hooks/use-theme';

function issueLabel(issue: ItineraryHealthIssue, tx: (zh: string, en: string) => string) {
  const labels = {
    CONFLICT: tx('时间重叠', 'Time conflict'),
    BUFFER: tx('衔接较紧', 'Tight buffer'),
    DENSE_DAY: tx('当天过密', 'Dense day'),
    MISSING_LOCATION: tx('缺少地点', 'Missing location'),
  } satisfies Record<ItineraryHealthIssue['type'], string>;
  return labels[issue.type];
}

function severityLabel(severity: ItineraryHealthIssue['severity'], tx: (zh: string, en: string) => string) {
  return {
    info: tx('提示', 'Note'),
    warning: tx('建议查看', 'Review'),
    critical: tx('需要处理', 'Action needed'),
  }[severity];
}

function useSeverityColors() {
  const theme = useTheme();
  return (severity: ItineraryHealthIssue['severity']) => ({
    critical: { color: theme.danger, soft: theme.dangerSoft },
    warning: { color: theme.plan, soft: theme.planSoft },
    info: { color: theme.info, soft: theme.infoSoft },
  }[severity]);
}

/** Marks a flagged plan in the timeline. Tapping it opens that plan's issues. */
export function ItineraryHealthHint({ issues, onPress }: { issues: ItineraryHealthIssue[]; onPress: () => void }) {
  const { tx } = useI18n();
  const severityColors = useSeverityColors();
  const [worst] = issues;
  if (!worst) return null;
  const { color, soft } = severityColors(worst.severity);
  const label = issueLabel(worst, tx) + (issues.length > 1 ? ` +${issues.length - 1}` : '');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tx(`${label}，查看建议`, `${label}, see suggestion`)}
      onPress={onPress}
      style={({ pressed }) => [styles.hint, { backgroundColor: soft }, pressed && styles.pressed]}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <ThemedText type="smallBold" style={{ color }}>{label}</ThemedText>
      <ThemedText type="small" style={{ color }}>{tx('· 查看建议', '· See suggestion')}</ThemedText>
    </Pressable>
  );
}

interface ItineraryHealthSheetProps {
  health: ItineraryHealth;
  items: ItineraryItem[];
  /** The flagged plan whose issues the sheet shows; absent keeps it closed. */
  itemId?: string;
  onDismiss: () => void;
  onEditItem?: (item: ItineraryItem) => void;
  /** Enables one-tap fixes for timing issues. Absent for view-only travellers. */
  fixes?: { trip: Pick<Trip, 'startsOn' | 'endsOn' | 'defaultTimeZone'>; onApply: (fix: HealthFix) => Promise<void> };
}

export function ItineraryHealthSheet({ health, items, itemId, onDismiss, onEditItem, fixes }: ItineraryHealthSheetProps) {
  const theme = useTheme();
  const { tx } = useI18n();
  const severityColors = useSeverityColors();
  const issues = itemId ? health.issuesByItemId.get(itemId) ?? [] : [];
  const itemById = new Map(items.map((item) => [item.id, item]));

  return (
    <BottomSheet onDismiss={onDismiss} title={tx('行程检查', 'Itinerary check')} visible={issues.length > 0}>
      <View style={styles.results}>
        {health.error ? <InlineNotice tone="error">{health.error}</InlineNotice> : null}
        {issues.map((issue) => {
          const statusColor = severityColors(issue.severity).color;
          const issueItems = issue.itemIds
            .map((id) => itemById.get(id))
            .filter((item): item is ItineraryItem => Boolean(item));
          const fix = fixes ? suggestHealthFix(issue, items, fixes.trip) : undefined;
          return (
            <View key={issue.id} style={[styles.issue, { borderColor: theme.border }]}>
              <View style={styles.issueHeader}>
                <View style={styles.issueLabel}>
                  <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                  <ThemedText type="smallBold">{issueLabel(issue, tx)}</ThemedText>
                </View>
                <ThemedText type="small" style={{ color: statusColor }}>
                  {severityLabel(issue.severity, tx)}
                </ThemedText>
              </View>
              <ThemedText type="smallBold">{issue.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{issue.reason}</ThemedText>
              {issue.question ? <ThemedText type="small" style={{ color: theme.info }}>{issue.question}</ThemedText> : null}
              {fix && fixes ? <HealthFixSuggestion fix={fix} timeZone={fixes.trip.defaultTimeZone} onApply={fixes.onApply} /> : null}
              {onEditItem && issueItems.length > 0 ? (
                <View style={styles.issueActions}>
                  {issueItems.map((item) => (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      accessibilityLabel={tx(`修改${item.title}`, `Edit ${item.title}`)}
                      onPress={() => onEditItem(item)}
                      style={({ pressed }) => [styles.editAction, pressed && styles.pressed]}>
                      <ThemedText type="smallBold" style={{ color: theme.link }}>{tx(`修改“${item.title}”`, `Edit “${item.title}”`)}</ThemedText>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {!onEditItem && issueItems.length > 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {tx('你当前只有查看权限，请联系可编辑成员修改。', 'You have view-only access. Ask an editor to make the change.')}
                </ThemedText>
              ) : null}
            </View>
          );
        })}
        <ActionButton tone="secondary" busy={health.busy} disabled={items.length === 0} onPress={() => void health.runCheck()}>
          {tx('重新检查', 'Check again')}
        </ActionButton>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  hint: {
    alignSelf: 'flex-start',
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
  },
  results: { gap: Spacing.sm },
  issue: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.xs },
  issueHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  issueLabel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  issueActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.xs },
  editAction: { minHeight: 44, maxWidth: '100%', flexShrink: 1, justifyContent: 'center' },
  pressed: { opacity: 0.62 },
});
