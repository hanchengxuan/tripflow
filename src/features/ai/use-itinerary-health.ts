import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ItineraryItem } from '@/domain/models';
import { analyzeItineraryHealth, type ItineraryHealthIssue, type ItineraryHealthReport } from '@/features/ai/itinerary-health';
import { useI18n } from '@/features/i18n/i18n-provider';
import { toUserMessage } from '@/lib/user-error';

const severityRank = { info: 0, warning: 1, critical: 2 } satisfies Record<ItineraryHealthIssue['severity'], number>;

export type ItineraryHealth = ReturnType<typeof useItineraryHealth>;

export function useItineraryHealth(items: ItineraryItem[]) {
  const { locale, tx } = useI18n();
  const [reportState, setReportState] = useState<{ signature: string; report: ItineraryHealthReport }>();
  const [busy, setBusy] = useState(false);
  const [errorState, setErrorState] = useState<{ signature: string; message: string }>();
  const latestItems = useRef(items);
  const itinerarySignature = useMemo(
    () => locale + ':' + items.map(({ id, startsAt, endsAt, title, locationLabel, googlePlaceId }) => [id, startsAt, endsAt, title, locationLabel, googlePlaceId].join(':')).join('|'),
    [items, locale],
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
        locale,
      });
      setReportState({ signature, report: nextReport });
    } catch (caught) {
      setErrorState({
        signature,
        message: toUserMessage(caught, tx('行程检查暂时不可用，请稍后重试。', 'The itinerary check is unavailable. Try again later.'), locale),
      });
    } finally {
      setBusy(false);
    }
  }, [itinerarySignature, locale, tx]);

  useEffect(() => {
    latestItems.current = items;
  }, [items]);

  useEffect(() => {
    const timeout = setTimeout(() => void runCheck(), 0);
    return () => clearTimeout(timeout);
  }, [itinerarySignature, runCheck]);

  /** Issues per plan, most severe first, so a row can show its worst problem. */
  const issuesByItemId = useMemo(() => {
    const byItem = new Map<string, ItineraryHealthIssue[]>();
    for (const issue of report?.issues ?? []) {
      for (const itemId of issue.itemIds) byItem.set(itemId, [...(byItem.get(itemId) ?? []), issue]);
    }
    for (const issues of byItem.values()) issues.sort((a, b) => severityRank[b.severity] - severityRank[a.severity]);
    return byItem;
  }, [report]);

  return { report, error, busy, runCheck, issuesByItemId };
}
