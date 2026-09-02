import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Chevron } from '@/components/chevron';
import { InlineNotice } from '@/components/form-controls';
import { ListDivider } from '@/components/list-surface';
import { ThemedText } from '@/components/themed-text';
import { Spacing, Radius, Size } from '@/constants/theme';
import type { ItineraryItem } from '@/domain/models';
import { useI18n } from '@/features/i18n/i18n-provider';
import { analyzeItineraryHealth, hasItineraryHealthIssues, type ItineraryHealthIssue, type ItineraryHealthReport } from '@/features/ai/itinerary-health';
import type { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface ItineraryHealthCardProps {
  items: ItineraryItem[];
  onEditItem?: (item: ItineraryItem) => void;
}

const severityColorKeys: Record<ItineraryHealthIssue['severity'], ThemeColor> = {
  info: 'info',
  warning: 'plan',
  critical: 'danger',
};

const severityRank: Record<ItineraryHealthIssue['severity'], number> = { info: 0, warning: 1, critical: 2 };

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

/**
 * Itinerary health.
 *
 * A tonal surface with one accent bar carrying the highest severity present —
 * the shape `InlineNotice` already uses — rather than a bordered card holding
 * bordered boxes. Each issue is one row with one action: pressing it opens the
 * first plan the issue names. Severity is stated once, as a dot beside its own
 * word, so the surface never offers more than one primary path.
 */
export function ItineraryHealthCard({ items, onEditItem }: ItineraryHealthCardProps) {
  const theme = useTheme();
  const { tx } = useI18n();
  const [reportState, setReportState] = useState<{ signature: string; report: ItineraryHealthReport }>();
  const [busy, setBusy] = useState(false);
  const [errorState, setErrorState] = useState<{ signature: string; message: string }>();
  const latestItems = useRef(items);
  const itinerarySignature = useMemo(
    () => items.map(({ id, startsAt, endsAt, title, locationLabel, googlePlaceId }) => [id, startsAt, endsAt, title, locationLabel, googlePlaceId].join(':')).join('|'),
    [items],
  );

  const report = reportState?.signature === itinerarySignature ? reportState.report : undefined;
  const error = errorState?.signature === itinerarySignature ? errorState.message : undefined;

  const runCheck = useCallback(async () => {
    const signature = itinerarySignature;
    setBusy(true);
    setErrorState(undefined);
    try {
      const nextReport = await analyzeItineraryHealth({
        items: latestItems.current,
      });
      setReportState({ signature, report: nextReport });
    } catch (caught) {
      setErrorState({
        signature,
        message: caught instanceof Error ? caught.message : tx('行程检查暂时不可用，请稍后重试。', 'The itinerary check is unavailable. Try again later.'),
      });
    } finally {
      setBusy(false);
    }
  }, [itinerarySignature, tx]);

  useEffect(() => {
    latestItems.current = items;
  }, [items]);

  useEffect(() => {
    const timeout = setTimeout(() => void runCheck(), 0);
    return () => clearTimeout(timeout);
  }, [itinerarySignature, runCheck]);

  if (!hasItineraryHealthIssues(report) && !error) return null;

  const itemById = new Map(items.map((item) => [item.id, item]));
  const issues = report?.issues ?? [];
  const highest = issues.reduce<ItineraryHealthIssue['severity']>(
    (worst, issue) => (severityRank[issue.severity] > severityRank[worst] ? issue.severity : worst),
    'info',
  );

  return (
    <View style={[styles.surface, { backgroundColor: theme.backgroundSubtle }]}>
      <View style={[styles.severityBar, { backgroundColor: error ? theme.danger : theme[severityColorKeys[highest]] }]} />
      <View style={styles.body}>
        <View style={styles.header}>
          <ThemedText style={styles.headerTitle}>
            {issues.length > 0
              ? tx(`行程体检 · ${String(issues.length)} 处待确认`, `Itinerary check · ${String(issues.length)} to confirm`)
              : tx('行程体检', 'Itinerary check')}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy, disabled: busy || items.length === 0 }}
            disabled={busy || items.length === 0}
            hitSlop={6}
            onPress={() => void runCheck()}
            style={({ pressed }) => [styles.recheck, (pressed || busy) && styles.pressed]}>
            <ThemedText type="smallBold" themeColor="link">
              {busy ? tx('检查中…', 'Checking…') : tx('重新检查', 'Check again')}
            </ThemedText>
          </Pressable>
        </View>

        {error ? (
          <View style={styles.errorRow}>
            <InlineNotice tone="error">{error}</InlineNotice>
          </View>
        ) : null}

        {issues.map((issue) => {
          const statusColor = theme[severityColorKeys[issue.severity]];
          const issueItems = issue.itemIds
            .map((itemId) => itemById.get(itemId))
            .filter((item): item is ItineraryItem => Boolean(item));
          const target = issueItems[0];
          const openTarget = onEditItem && target ? () => onEditItem(target) : undefined;
          const copy = (
            <View style={styles.issueCopy}>
              <View style={styles.issueStatus}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <ThemedText style={[styles.issueKind, { color: statusColor }]}>
                  {issueLabel(issue, tx) + ' · ' + severityLabel(issue.severity, tx)}
                </ThemedText>
              </View>
              <ThemedText style={styles.issueTitle}>{issue.title}</ThemedText>
              <ThemedText style={styles.issueReason} themeColor="textSecondary">
                {issue.question ? issue.reason + ' ' + issue.question : issue.reason}
              </ThemedText>
              {!onEditItem && issueItems.length > 0 ? (
                <ThemedText style={styles.issueReason} themeColor="textMuted">
                  {tx('你当前只有查看权限，请联系可编辑成员修改。', 'You have view-only access. Ask an editor to make the change.')}
                </ThemedText>
              ) : null}
            </View>
          );
          return (
            <View key={issue.id}>
              <ListDivider />
              {openTarget ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={tx(`修改“${target.title}”`, `Edit “${target.title}”`)}
                  onPress={openTarget}
                  style={({ pressed }) => [styles.issueRow, pressed && styles.pressed]}>
                  {copy}
                  <Chevron color={theme.textMuted} />
                </Pressable>
              ) : (
                <View style={styles.issueRow}>{copy}</View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: { borderRadius: Radius.lg, overflow: 'hidden', flexDirection: 'row', alignItems: 'stretch' },
  severityBar: { width: 3 },
  body: { flex: 1, minWidth: 0, paddingHorizontal: Spacing.md, paddingVertical: 2 },
  header: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 12 },
  headerTitle: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 20, fontWeight: '600' },
  recheck: { minHeight: Size.touchMin, justifyContent: 'center', paddingHorizontal: Spacing['2xs'] },
  errorRow: { paddingBottom: 12 },
  issueRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 12 },
  issueCopy: { flex: 1, minWidth: 0, gap: 2 },
  issueStatus: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  issueKind: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
  issueTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  issueReason: { fontSize: 12, lineHeight: 17, fontWeight: '500' },
  pressed: { opacity: 0.68 },
});
