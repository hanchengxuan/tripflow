import type { ItineraryItem, ItineraryKind, Trip } from '@/domain/models';
import { invokeEdgeFunction } from '@/lib/edge-function';
import { zonedDateTimeToIso } from '@/lib/trip-time';

export interface TripChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

type PlanBasis = Pick<ItineraryItem, 'title' | 'startsAt' | 'endsAt'> & { timeZone?: string };

/** A change the assistant proposes; nothing is saved until the traveller confirms it. */
export type TripChatAction =
  | { type: 'update_plan'; itemId: string; title?: string; startLocal?: string; endLocal?: string; before?: PlanBasis }
  | { type: 'add_plan'; kind: ItineraryKind; title: string; startLocal: string; endLocal: string; place?: string }
  | { type: 'add_expense'; title: string; amount: string; currency: string; payerUserId?: string; participantUserIds?: string[] };

/** A proposal as shown in the conversation: what the plan looked like when it was proposed, and whether it was confirmed. */
export interface TripChatProposal {
  action: TripChatAction;
  before?: PlanBasis;
  status: 'pending' | 'saved' | 'opened';
}

export function proposalsFromReply(actions: TripChatAction[], items: ItineraryItem[]): TripChatProposal[] {
  return actions.map((action) => {
    const item = action.type === 'update_plan' ? items.find(({ id }) => id === action.itemId) : undefined;
    const before = action.type === 'update_plan' ? action.before ?? (item ? { title: item.title, startsAt: item.startsAt, endsAt: item.endsAt } : undefined) : undefined;
    return { action, status: 'pending', ...(before ? { before } : {}) };
  });
}

export interface TripChatReply {
  answer: string;
  actions: TripChatAction[];
  run?: { status: 'completed' | 'limited'; steps: number; toolCalls: number };
  warnings?: string[];
}

const localTime = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
const kinds = new Set<ItineraryKind>(['transport', 'lodging', 'food', 'activity', 'note', 'task']);
const text = (value: unknown, max: number) => typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;
const time = (value: unknown) => typeof value === 'string' && localTime.test(value) ? value : undefined;

function parseAction(raw: unknown, planIds: Set<string>, memberIds: Set<string>): TripChatAction | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const action = raw as Record<string, unknown>;
  if (action.type === 'update_plan') {
    if (typeof action.itemId !== 'string' || !planIds.has(action.itemId)) return undefined;
    const change = { title: text(action.title, 180), startLocal: time(action.startLocal), endLocal: time(action.endLocal) };
    if (!change.title && !change.startLocal && !change.endLocal) return undefined;
    let before: PlanBasis | undefined;
    if (action.before !== undefined) {
      const basis = action.before;
      if (!basis || typeof basis !== 'object' || !('title' in basis) || !('startsAt' in basis) || !('timeZone' in basis)
        || typeof basis.title !== 'string' || typeof basis.startsAt !== 'string' || !Number.isFinite(Date.parse(basis.startsAt))
        || typeof basis.timeZone !== 'string' || basis.timeZone.length > 80) return undefined;
      const endsAt = 'endsAt' in basis ? basis.endsAt : undefined;
      if (endsAt !== undefined && (typeof endsAt !== 'string' || !Number.isFinite(Date.parse(endsAt)))) return undefined;
      try { new Intl.DateTimeFormat('en', { timeZone: basis.timeZone }); } catch { return undefined; }
      before = { title: basis.title, startsAt: basis.startsAt, ...(typeof endsAt === 'string' ? { endsAt } : {}), timeZone: basis.timeZone };
    }
    return { type: 'update_plan', itemId: action.itemId, ...Object.fromEntries(Object.entries(change).filter(([, value]) => value)), ...(before ? { before } : {}) };
  }
  if (action.type === 'add_plan') {
    const kind = kinds.has(action.kind as ItineraryKind) ? action.kind as ItineraryKind : undefined;
    const title = text(action.title, 180);
    const startLocal = time(action.startLocal);
    const endLocal = time(action.endLocal);
    if (!kind || !title || !startLocal || !endLocal || endLocal <= startLocal) return undefined;
    const place = text(action.place, 500);
    return { type: 'add_plan', kind, title, startLocal, endLocal, ...(place ? { place } : {}) };
  }
  if (action.type === 'add_expense') {
    const title = text(action.title, 180);
    const amount = typeof action.amount === 'string' && /^\d+(?:\.\d{1,2})?$/.test(action.amount) && Number(action.amount) > 0 ? action.amount : undefined;
    const currency = typeof action.currency === 'string' && /^[A-Z]{3}$/.test(action.currency) ? action.currency : undefined;
    if (!title || !amount || !currency) return undefined;
    const payerUserId = typeof action.payerUserId === 'string' && memberIds.has(action.payerUserId) ? action.payerUserId : undefined;
    const participantUserIds = Array.isArray(action.participantUserIds)
      ? [...new Set(action.participantUserIds.filter((id): id is string => typeof id === 'string' && memberIds.has(id)))]
      : [];
    return { type: 'add_expense', title, amount, currency, ...(payerUserId ? { payerUserId } : {}), ...(participantUserIds.length ? { participantUserIds } : {}) };
  }
  return undefined;
}

export function validateTripChatReply(value: unknown, planIds: string[], memberIds: string[]): TripChatReply {
  const reply = value && typeof value === 'object' ? value as { answer?: unknown; actions?: unknown; run?: unknown; warnings?: unknown } : {};
  const answer = text(reply.answer, 800) ?? '';
  const plans = new Set(planIds);
  const members = new Set(memberIds);
  const actions = (Array.isArray(reply.actions) ? reply.actions : [])
    .map((action) => parseAction(action, plans, members))
    .filter((action): action is TripChatAction => Boolean(action))
    .slice(0, 5);
  if (!answer && actions.length === 0) throw new Error('行程助手没有给出回答，请换个说法。');
  const rawRun = reply.run;
  let run: TripChatReply['run'];
  if (rawRun && typeof rawRun === 'object' && 'status' in rawRun && 'steps' in rawRun && 'toolCalls' in rawRun
    && (rawRun.status === 'completed' || rawRun.status === 'limited')
    && typeof rawRun.steps === 'number' && Number.isSafeInteger(rawRun.steps) && rawRun.steps >= 0
    && typeof rawRun.toolCalls === 'number' && Number.isSafeInteger(rawRun.toolCalls) && rawRun.toolCalls >= 0) {
    run = { status: rawRun.status, steps: rawRun.steps, toolCalls: rawRun.toolCalls };
  }
  const warnings = Array.isArray(reply.warnings) ? reply.warnings.filter((warning): warning is string => typeof warning === 'string').slice(0, 10) : undefined;
  return { answer, actions, ...(run ? { run } : {}), ...(warnings ? { warnings } : {}) };
}

export async function sendTripChat(input: {
  tripId: string;
  messages: TripChatMessage[];
  planIds: string[];
  memberIds: string[];
  locale: 'zh-CN' | 'en';
  image?: { base64: string; mimeType: string };
  signal?: AbortSignal;
}) {
  const body = {
    tripId: input.tripId,
    messages: input.messages.slice(-12),
    locale: input.locale,
    ...(input.image ? { imageBase64: input.image.base64, imageMimeType: input.image.mimeType } : {}),
  };
  const data = input.signal
    ? await invokeEdgeFunction<unknown>('ask-trip', body, { signal: input.signal })
    : await invokeEdgeFunction<unknown>('ask-trip', body);
  return validateTripChatReply(data, input.planIds, input.memberIds);
}

const toIso = (local: string, timeZone: string) => zonedDateTimeToIso(local.slice(0, 10), local.slice(11, 16), timeZone);

export async function transcribeTripChat(input: { tripId: string; audioBase64: string; audioMimeType: string }) {
  const data = await invokeEdgeFunction<{ transcript?: unknown }>('ask-trip', { ...input, mode: 'transcribe' });
  if (typeof data?.transcript !== 'string' || !data.transcript.trim()) throw new Error('Transcript is unavailable');
  return data.transcript.trim();
}

export function planTimeZone(item: Pick<ItineraryItem, 'destination'> | undefined, trip: Pick<Trip, 'defaultTimeZone'>) {
  return item?.destination?.timeZone ?? trip.defaultTimeZone;
}

/** The saved plan fields after an update proposal; moving only the start keeps the plan's length. */
export function planChangeFromAction(
  action: Extract<TripChatAction, { type: 'update_plan' }>,
  item: ItineraryItem,
  trip: Pick<Trip, 'defaultTimeZone'>,
) {
  const timeZone = planTimeZone(item, trip);
  const startsAt = action.startLocal ? toIso(action.startLocal, timeZone) : new Date(item.startsAt).toISOString();
  const lengthMs = new Date(item.endsAt ?? item.startsAt).getTime() - new Date(item.startsAt).getTime();
  const endsAt = action.endLocal
    ? toIso(action.endLocal, timeZone)
    : new Date(new Date(startsAt).getTime() + Math.max(lengthMs, 0)).toISOString();
  if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) throw new Error('结束时间需要晚于开始时间。');
  return { title: action.title ?? item.title, startsAt, endsAt };
}

export function newPlanFromAction(action: Extract<TripChatAction, { type: 'add_plan' }>, trip: Pick<Trip, 'defaultTimeZone'>) {
  return {
    kind: action.kind,
    title: action.title,
    startsAt: toIso(action.startLocal, trip.defaultTimeZone),
    endsAt: toIso(action.endLocal, trip.defaultTimeZone),
    ...(action.place ? { locationLabel: action.place } : {}),
  };
}
