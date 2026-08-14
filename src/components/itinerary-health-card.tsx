import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionButton, InlineNotice } from '@/components/form-controls';
import { ThemedText } from '@/components/themed-text';
import { Spacing, Radius } from '@/constants/theme';
import type { ItineraryItem } from '@/domain/models';
import { useI18n } from '@/features/i18n/i18n-provider';
import { analyzeItineraryHealth, type ItineraryHealthIssue, type ItineraryHealthReport } from '@/features/ai/itinerary-health';
import { useTheme } from '@/hooks/use-theme';

interface ItineraryHealthCardProps {
  items: ItineraryItem[];
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

export function ItineraryHealthCard({ items }: ItineraryHealthCardProps) {
  const theme = useTheme();
  const { tx } = useI18n();
  const [reportState, setReportState] = useState<{ signature: string; report: ItineraryHealthReport }>();
  const [busy, setBusy] = useState(false);
  const [errorState, setErrorState] = useState<{ signature: string; message: string }>();
  const itinerarySignature = useMemo(
    () => items.map(({ id, startsAt, endsAt, title, locationLabel, googlePlaceId }) => [id, startsAt, endsAt, title, locationLabel, googlePlaceId].join(':')).join('|'),
    [items],
  );

  const report = reportState?.signature === itinerarySignature ? reportState.report : undefined;
  const error = errorState?.signature === itinerarySignature ? errorState.message : undefined;

  const runCheck = async () => {
    setBusy(true);
    setErrorState(undefined);
    try {
      const nextReport = await analyzeItineraryHealth({
        items,
      });
      setReportState({ signature: itinerarySignature, report: nextReport });
    } catch (caught) {
      setErrorState({
        signature: itinerarySignature,
        message: caught instanceof Error ? caught.message : tx('行程检查暂时不可用，请稍后重试。', 'The itinerary check is unavailable. Try again later.'),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.header}>
        <View style={styles.heading}>
          <ThemedText type="smallBold">{tx('行程检查', 'Itinerary check')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {tx('本地查看冲突和衔接', 'On-device check for conflicts and gaps')}
          </ThemedText>
        </View>
        <ActionButton tone="secondary" busy={busy} disabled={items.length === 0} onPress={() => void runCheck()}>
          {report ? tx('重新检查', 'Check again') : tx('检查', 'Check')}
        </ActionButton>
      </View>

      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}

      {report ? (
        <View style={styles.results}>
          <ThemedText type="smallBold">{report.summary}</ThemedText>
          {report.issues.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {tx('暂未发现需要处理的问题。', 'Nothing needs attention right now.')}
            </ThemedText>
          ) : (
            report.issues.map((issue) => {
              const statusColor = issue.severity === 'critical'
                ? theme.danger
                : issue.severity === 'warning'
                  ? theme.plan
                  : theme.info;
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
                </View>
              );
            })
          )}
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
});
