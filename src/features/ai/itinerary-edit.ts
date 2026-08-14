import type { ItineraryItem, Trip } from '@/domain/models';
import { isoToZonedDateTime } from '@/lib/trip-time';
import { getSupabaseClient } from '@/lib/supabase';

export interface ItineraryEditChange {
  itemId: string;
  title?: string;
  startsAt?: string;
  endsAt?: string;
  reason: string;
}

export interface ItineraryEditProposal {
  summary: string;
  confidence: number;
  changes: ItineraryEditChange[];
  warnings: string[];
  model?: string;
}

export type ItineraryEditValidationCode = 'INVALID_RANGE' | 'OUTSIDE_TRIP' | 'OVERLAP';

export interface ItineraryEditValidationIssue {
  code: ItineraryEditValidationCode;
  itemIds: string[];
}

export interface ItineraryEditValidationResult {
  errors: ItineraryEditValidationIssue[];
  candidate?: ItineraryItem;
}

function boundedText(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== 'string') return fallback;
  const text = value.trim();
  return text ? text.slice(0, maxLength) : fallback;
}

function validIso(value: unknown) {
  return typeof value === 'string' && Number.isFinite(new Date(value).getTime());
}

export function validateItineraryEditProposal(value: unknown, itemIds: string[]): ItineraryEditProposal {
  if (!value || typeof value !== 'object') throw new Error('AI 返回的修改格式无效。');

  const payload = value as {
    summary?: unknown;
    confidence?: unknown;
    changes?: unknown;
    warnings?: unknown;
    model?: unknown;
  };
  const rawChanges = Array.isArray(payload.changes) ? payload.changes : [];
  if (rawChanges.length > 1) throw new Error('一次只能预览一项安排的修改。');

  const allowedItemIds = new Set(itemIds);
  const changes = rawChanges.flatMap((rawChange) => {
    if (!rawChange || typeof rawChange !== 'object') return [];
    const change = rawChange as Partial<ItineraryEditChange>;
    if (typeof change.itemId !== 'string' || !allowedItemIds.has(change.itemId)) {
      throw new Error('AI 返回了不存在的行程安排。');
    }
    const keys = Object.keys(rawChange);
    if (keys.some((key) => !['itemId', 'title', 'startsAt', 'endsAt', 'reason'].includes(key))) {
      throw new Error('这次智能调整包含了暂不支持的字段。');
    }
    const title = change.title === undefined ? undefined : boundedText(change.title, '', 180);
    if (change.title !== undefined && !title) throw new Error('AI 返回了空的安排名称。');
    if (change.startsAt !== undefined && !validIso(change.startsAt)) throw new Error('AI 返回了无效的开始时间。');
    if (change.endsAt !== undefined && !validIso(change.endsAt)) throw new Error('AI 返回了无效的结束时间。');
    if (change.startsAt && change.endsAt && new Date(change.endsAt).getTime() <= new Date(change.startsAt).getTime()) {
      throw new Error('修改后的结束时间必须晚于开始时间。');
    }
    const reason = boundedText(change.reason, '', 360);
    if (!reason) throw new Error('AI 没有说明修改原因。');
    if (!title && change.startsAt === undefined && change.endsAt === undefined) throw new Error('AI 没有识别到需要修改的字段。');
    return [{
      itemId: change.itemId,
      ...(title ? { title } : {}),
      ...(change.startsAt ? { startsAt: change.startsAt } : {}),
      ...(change.endsAt ? { endsAt: change.endsAt } : {}),
      reason,
    } satisfies ItineraryEditChange];
  });

  const confidenceValue = typeof payload.confidence === 'number' && Number.isFinite(payload.confidence)
    ? payload.confidence
    : 0;
  const warnings = Array.isArray(payload.warnings)
    ? payload.warnings.filter((warning): warning is string => typeof warning === 'string' && warning.trim().length > 0).map((warning) => warning.trim().slice(0, 220)).slice(0, 4)
    : [];

  return {
    summary: boundedText(payload.summary, changes.length ? '请确认这项行程修改。' : '没有识别到明确的修改。', 240),
    confidence: Math.max(0, Math.min(1, confidenceValue)),
    changes,
    warnings,
    ...(typeof payload.model === 'string' && payload.model.trim() ? { model: payload.model.trim().slice(0, 80) } : {}),
  };
}

export function mergeItineraryEdit(item: ItineraryItem, change: ItineraryEditChange): ItineraryItem {
  const startsAt = change.startsAt ?? item.startsAt;
  const endsAt = change.endsAt ?? item.endsAt;
  const startDelta = change.startsAt ? new Date(change.startsAt).getTime() - new Date(item.startsAt).getTime() : 0;
  const shiftedEnd = !change.endsAt && item.endsAt && Number.isFinite(startDelta)
    ? new Date(new Date(item.endsAt).getTime() + startDelta).toISOString()
    : endsAt;

  return {
    ...item,
    ...(change.title ? { title: change.title } : {}),
    startsAt,
    ...(shiftedEnd ? { endsAt: shiftedEnd } : { endsAt: undefined }),
  };
}

function itemInterval(item: ItineraryItem) {
  const startsAt = new Date(item.startsAt).getTime();
  const endsAt = item.endsAt ? new Date(item.endsAt).getTime() : startsAt;
  return { startsAt, endsAt };
}

export function validateMergedItineraryEdit(input: {
  candidate: ItineraryItem;
  items: ItineraryItem[];
  trip: Pick<Trip, 'startsOn' | 'endsOn'>;
  timeZone: string;
}): ItineraryEditValidationResult {
  const { candidate, items, trip, timeZone } = input;
  const candidateInterval = itemInterval(candidate);
  if (!candidate.endsAt || !Number.isFinite(candidateInterval.startsAt) || !Number.isFinite(candidateInterval.endsAt) || candidateInterval.endsAt <= candidateInterval.startsAt) {
    return { errors: [{ code: 'INVALID_RANGE', itemIds: [candidate.id] }] };
  }

  const candidateStartDate = isoToZonedDateTime(candidate.startsAt, timeZone).date;
  const candidateEndDate = isoToZonedDateTime(candidate.endsAt ?? candidate.startsAt, timeZone).date;
  if (candidateStartDate < trip.startsOn || candidateEndDate > trip.endsOn) {
    return { errors: [{ code: 'OUTSIDE_TRIP', itemIds: [candidate.id] }] };
  }

  const conflict = items.find((item) => {
    if (item.id === candidate.id || !item.endsAt) return false;
    const interval = itemInterval(item);
    return candidateInterval.startsAt < interval.endsAt && candidateInterval.endsAt > interval.startsAt;
  });
  if (conflict) return { errors: [{ code: 'OVERLAP', itemIds: [candidate.id, conflict.id] }] };

  return { errors: [], candidate };
}

export async function suggestItineraryEdit(input: { tripId: string; itemId: string; instruction: string }) {
  const instruction = input.instruction.trim();
  if (!instruction || instruction.length > 500) throw new Error('请输入 1 到 500 个字符的调整说明。');
  const { data, error } = await getSupabaseClient().functions.invoke('suggest-itinerary-edit', {
    body: { tripId: input.tripId, itemId: input.itemId, instruction },
  });
  if (error) {
    const response = (error as { context?: Response }).context;
    if (response) {
      try {
        const body = await response.clone().json() as { error?: unknown };
        if (typeof body.error === 'string') throw new Error(body.error);
      } catch (caught) {
        if (caught instanceof Error && /[㐀-鿿]/u.test(caught.message)) throw caught;
      }
    }
    throw error;
  }
  const proposal = validateItineraryEditProposal(data?.proposal, [input.itemId]);
  return { ...proposal, model: typeof data?.model === 'string' ? data.model : proposal.model };
}
