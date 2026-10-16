import { InputError } from '@/domain/input-error';
import type { ItineraryItem } from '@/domain/models';
import type { AppLocale } from '@/features/i18n/i18n-provider';

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

export function validateItineraryHealthReport(value: unknown, itemIds: string[], locale: AppLocale = 'en'): ItineraryHealthReport {
  const tx = (zh: string, en: string) => locale === 'zh-CN' ? zh : en;
  if (!value || typeof value !== 'object') throw new InputError('行程检查格式无效。', 'The itinerary check returned an invalid report.');

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
      title: boundedText(issue.title, tx('请检查这项安排', 'Review this itinerary item'), 160),
      reason: boundedText(issue.reason, tx('这项安排可能需要检查。', 'The plan may need a quick review.'), 360),
      confidence: Math.max(0, Math.min(1, confidenceValue)),
      ...(typeof issue.question === 'string' && issue.question.trim()
        ? { question: issue.question.trim().slice(0, 220) }
        : {}),
    } satisfies ItineraryHealthIssue];
  });

  return {
    summary: boundedText(payload.summary, tx('行程目前没有需要处理的问题。', 'No obvious itinerary issues found.'), 240),
    issues,
  };
}

/** A stay spans whole nights, so it only competes for time with another stay, not with the plans inside it. */
export function competesForTime(left: ItineraryItem, right: ItineraryItem) {
  return (left.kind === 'lodging') === (right.kind === 'lodging');
}

function dateKey(value: string) {
  return value.slice(0, 10);
}

function localHealthReport(items: ItineraryItem[], locale: AppLocale): ItineraryHealthReport {
  const tx = (zh: string, en: string) => locale === 'zh-CN' ? zh : en;
  const scopedItems = [...items].sort((left, right) => left.startsAt.localeCompare(right.startsAt)).slice(0, 30);
  const issues: ItineraryHealthIssue[] = [];
  const requiredLocationKinds = new Set(['transport', 'lodging', 'food', 'activity']);

  const previousInLane = new Map<boolean, ItineraryItem>();

  scopedItems.forEach((item) => {
    if (requiredLocationKinds.has(item.kind) && !item.locationLabel?.trim() && !item.googlePlaceId) {
      issues.push({
        id: `missing-location-${item.id}`,
        type: 'MISSING_LOCATION',
        severity: 'warning',
        itemIds: [item.id],
        title: item.title || tx('安排缺少地点', 'Missing location'),
        reason: tx('这项安排没有地点，出发前可能需要补充。', 'This plan has no location. Add one before you leave.'),
        confidence: 1,
      });
    }
    const lane = item.kind === 'lodging';
    const previous = previousInLane.get(lane);
    previousInLane.set(lane, item);
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
        title: tx('时间安排重叠', 'Overlapping plans'),
        reason: tx(`${previous.title} 与 ${item.title} 的时间有重叠。`, `“${previous.title}” and “${item.title}” overlap.`),
        confidence: 1,
      });
    } else if (dateKey(previous.startsAt) === dateKey(item.startsAt) && currentStart - previousEnd < 30 * 60 * 1000) {
      issues.push({
        id: `buffer-${previous.id}-${item.id}`,
        type: 'BUFFER',
        severity: 'warning',
        itemIds: [previous.id, item.id],
        title: tx('衔接时间较短', 'Short gap between plans'),
        reason: tx(`${previous.title} 结束后到 ${item.title} 开始不足 30 分钟。`, `There are fewer than 30 minutes between the end of “${previous.title}” and the start of “${item.title}”.`),
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
      title: tx(`${day} 有 ${dayItems.length} 项安排`, `${dayItems.length} plans on ${day}`),
      reason: tx('当天安排较多，建议预留休息或临时变更的空间。', 'This day has several plans. Leave room for breaks or unexpected changes.'),
      confidence: 0.84,
    });
  });

  const uniqueIssues = [...new Map(issues.map((issue) => [issue.id, issue])).values()].slice(0, 8);
  return {
    summary: uniqueIssues.length === 0
      ? tx('行程目前没有需要处理的问题。', 'No itinerary issues need attention right now.')
      : tx(`发现 ${uniqueIssues.length} 个需要处理的行程问题。`, `${uniqueIssues.length} itinerary ${uniqueIssues.length === 1 ? 'issue needs' : 'issues need'} attention.`),
    issues: uniqueIssues,
  };
}

export async function analyzeItineraryHealth(input: { items: ItineraryItem[]; locale: AppLocale }) {
  const itemIds = input.items.map((item) => item.id).slice(0, 30);
  return validateItineraryHealthReport(localHealthReport(input.items, input.locale), itemIds, input.locale);
}
