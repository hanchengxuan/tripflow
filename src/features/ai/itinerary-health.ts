import type { ItineraryItem } from '@/domain/models';

export type ItineraryHealthIssueType = 'CONFLICT' | 'BUFFER' | 'DENSE_DAY' | 'MISSING_LOCATION';
export type ItineraryHealthSeverity = 'info' | 'warning' | 'critical';

export interface ItineraryHealthIssue {
  id: string;
  type: ItineraryHealthIssueType;
  severity: ItineraryHealthSeverity;
  itemIds: string[];
  title: string;
  reason: string;
  confidence: number;
  question?: string;
}

export interface ItineraryHealthReport {
  summary: string;
  issues: ItineraryHealthIssue[];
}

export function hasItineraryHealthIssues(report: ItineraryHealthReport | undefined) {
  return Boolean(report?.issues.length);
}

const issueTypes = new Set<ItineraryHealthIssueType>(['CONFLICT', 'BUFFER', 'DENSE_DAY', 'MISSING_LOCATION']);
const severities = new Set<ItineraryHealthSeverity>(['info', 'warning', 'critical']);

function boundedText(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== 'string') return fallback;
  const text = value.trim();
  return text ? text.slice(0, maxLength) : fallback;
}

export function validateItineraryHealthReport(value: unknown, itemIds: string[]): ItineraryHealthReport {
  if (!value || typeof value !== 'object') throw new Error('AI 返回的行程检查格式无效。');

  const payload = value as { summary?: unknown; issues?: unknown };
  const allowedItemIds = new Set(itemIds);
  const rawIssues = Array.isArray(payload.issues) ? payload.issues : [];
  const issues = rawIssues.slice(0, 8).flatMap((rawIssue, index) => {
    if (!rawIssue || typeof rawIssue !== 'object') return [];
    const issue = rawIssue as Partial<ItineraryHealthIssue>;
    const type = issue.type;
    const severity = issue.severity;
    if (typeof type !== 'string' || !issueTypes.has(type as ItineraryHealthIssueType)) return [];
    if (typeof severity !== 'string' || !severities.has(severity as ItineraryHealthSeverity)) return [];

    const scopedItemIds = Array.isArray(issue.itemIds)
      ? [...new Set(issue.itemIds.filter((id): id is string => typeof id === 'string' && allowedItemIds.has(id)))].slice(0, 4)
      : [];
    if (scopedItemIds.length === 0) return [];

    const confidenceValue = typeof issue.confidence === 'number' && Number.isFinite(issue.confidence)
      ? issue.confidence
      : 0;

    return [{
      id: boundedText(issue.id, `issue-${index + 1}`, 64),
      type: type as ItineraryHealthIssueType,
      severity: severity as ItineraryHealthSeverity,
      itemIds: scopedItemIds,
      title: boundedText(issue.title, 'Review this itinerary item', 160),
      reason: boundedText(issue.reason, 'The plan may need a quick review.', 360),
      confidence: Math.max(0, Math.min(1, confidenceValue)),
      ...(typeof issue.question === 'string' && issue.question.trim()
        ? { question: issue.question.trim().slice(0, 220) }
        : {}),
    } satisfies ItineraryHealthIssue];
  });

  return {
    summary: boundedText(payload.summary, 'No obvious itinerary issues found.', 240),
    issues,
  };
}

function dateKey(value: string) {
  return value.slice(0, 10);
}

function localHealthReport(items: ItineraryItem[]): ItineraryHealthReport {
  const scopedItems = [...items].sort((left, right) => left.startsAt.localeCompare(right.startsAt)).slice(0, 30);
  const issues: ItineraryHealthIssue[] = [];
  const requiredLocationKinds = new Set(['transport', 'lodging', 'food', 'activity']);

  scopedItems.forEach((item, index) => {
    if (requiredLocationKinds.has(item.kind) && !item.locationLabel?.trim() && !item.googlePlaceId) {
      issues.push({
        id: `missing-location-${item.id}`,
        type: 'MISSING_LOCATION',
        severity: 'warning',
        itemIds: [item.id],
        title: item.title || '安排缺少地点',
        reason: '这项安排没有地点，出发前可能需要补充。',
        confidence: 1,
      });
    }
    const previous = scopedItems[index - 1];
    if (!previous?.endsAt) return;
    const previousEnd = new Date(previous.endsAt).getTime();
    const currentStart = new Date(item.startsAt).getTime();
    if (!Number.isFinite(previousEnd) || !Number.isFinite(currentStart)) return;
    if (previousEnd > currentStart) {
      issues.push({
        id: `conflict-${previous.id}-${item.id}`,
        type: 'CONFLICT',
        severity: 'critical',
        itemIds: [previous.id, item.id],
        title: '时间安排重叠',
        reason: `${previous.title} 与 ${item.title} 的时间有重叠。`,
        confidence: 1,
      });
    } else if (dateKey(previous.startsAt) === dateKey(item.startsAt) && currentStart - previousEnd < 30 * 60 * 1000) {
      issues.push({
        id: `buffer-${previous.id}-${item.id}`,
        type: 'BUFFER',
        severity: 'warning',
        itemIds: [previous.id, item.id],
        title: '衔接时间较短',
        reason: `${previous.title} 结束后到 ${item.title} 开始不足 30 分钟。`,
        confidence: 0.92,
      });
    }
  });

  const dayCounts = new Map<string, ItineraryItem[]>();
  scopedItems.forEach((item) => {
    const day = dateKey(item.startsAt);
    dayCounts.set(day, [...(dayCounts.get(day) ?? []), item]);
  });
  dayCounts.forEach((dayItems, day) => {
    if (dayItems.length < 5) return;
    issues.push({
      id: `dense-day-${day}`,
      type: 'DENSE_DAY',
      severity: 'info',
      itemIds: dayItems.slice(0, 4).map((item) => item.id),
      title: `${day} 有 ${dayItems.length} 项安排`,
      reason: '当天安排较多，建议预留休息或临时变更的空间。',
      confidence: 0.84,
    });
  });

  const uniqueIssues = [...new Map(issues.map((issue) => [issue.id, issue])).values()].slice(0, 8);
  return {
    summary: uniqueIssues.length === 0
      ? '行程目前没有需要处理的问题。'
      : `发现 ${uniqueIssues.length} 个需要处理的行程问题。`,
    issues: uniqueIssues,
  };
}

export async function analyzeItineraryHealth(input: { items: ItineraryItem[] }) {
  const itemIds = input.items.map((item) => item.id).slice(0, 30);
  return validateItineraryHealthReport(localHealthReport(input.items), itemIds);
}
