import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ActionButton, InlineNotice } from '@/components/form-controls';
import { ThemedText } from '@/components/themed-text';
import { Spacing, Radius } from '@/constants/theme';
import type { ItineraryItem } from '@/domain/models';
import { useI18n } from '@/features/i18n/i18n-provider';
import { analyzeItineraryHealth, hasItineraryHealthIssues, type ItineraryHealthIssue, type ItineraryHealthReport } from '@/features/ai/itinerary-health';
import { useTheme } from '@/hooks/use-theme';

interface ItineraryHealthCardProps {
  items: ItineraryItem[];
  onEditItem?: (item: ItineraryItem) => void;
}

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

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.header}>
        <View style={styles.heading}>
          <ThemedText type="smallBold">{tx('发现行程问题', 'Itinerary needs attention')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {tx('检测到冲突或衔接问题，可直接修改安排。', 'A conflict or tight gap was found. Edit the plan directly.')}
          </ThemedText>
        </View>
        <ActionButton tone="secondary" busy={busy} disabled={items.length === 0} onPress={() => void runCheck()}>
          {tx('重新检查', 'Check again')}
        </ActionButton>
      </View>

      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}

      {report ? (
        <View style={styles.results}>
          <ThemedText type="smallBold">{report.summary}</ThemedText>
          {report.issues.map((issue) => {
            const statusColor = issue.severity === 'critical'
              ? theme.danger
              : issue.severity === 'warning'
                ? theme.plan
                : theme.info;
            const issueItems = issue.itemIds
              .map((itemId) => itemById.get(itemId))
              .filter((item): item is ItineraryItem => Boolean(item));
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
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  heading: { flex: 1, gap: Spacing.xs },
  results: { gap: Spacing.sm },
  issue: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.xs },
  issueHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  issueLabel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  issueActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.xs },
  editAction: { minHeight: 44, justifyContent: 'center' },
  pressed: { opacity: 0.62 },
});
