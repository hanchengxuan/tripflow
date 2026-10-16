import type { ItineraryItem, ItineraryKind, Trip } from '@/domain/models';
import { invokeEdgeFunction } from '@/lib/edge-function';
import { zonedDateTimeToIso } from '@/lib/trip-time';

export interface TripChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

/** A change the assistant proposes; nothing is saved until the traveller confirms it. */
export type TripChatAction =
  | { type: 'update_plan'; itemId: string; title?: string; startLocal?: string; endLocal?: string }
  | { type: 'add_plan'; kind: ItineraryKind; title: string; startLocal: string; endLocal: string; place?: string }
  | { type: 'add_expense'; title: string; amount: string; currency: string; payerUserId?: string; participantUserIds?: string[] };

/** A proposal as shown in the conversation: what the plan looked like when it was proposed, and whether it was confirmed. */
export interface TripChatProposal {
  action: TripChatAction;
  before?: Pick<ItineraryItem, 'title' | 'startsAt' | 'endsAt'>;
  status: 'pending' | 'saved' | 'opened';
}

export function proposalsFromReply(actions: TripChatAction[], items: ItineraryItem[]): TripChatProposal[] {
  return actions.map((action) => {
    const item = action.type === 'update_plan' ? items.find(({ id }) => id === action.itemId) : undefined;
    return { action, status: 'pending', ...(item ? { before: { title: item.title, startsAt: item.startsAt, endsAt: item.endsAt } } : {}) };
  });
}

export interface TripChatReply {
  answer: string;
  actions: TripChatAction[];
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
    return { type: 'update_plan', itemId: action.itemId, ...Object.fromEntries(Object.entries(change).filter(([, value]) => value)) };
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
  const reply = value && typeof value === 'object' ? value as { answer?: unknown; actions?: unknown } : {};
  const answer = text(reply.answer, 800) ?? '';
  const plans = new Set(planIds);
  const members = new Set(memberIds);
  const actions = (Array.isArray(reply.actions) ? reply.actions : [])
    .map((action) => parseAction(action, plans, members))
    .filter((action): action is TripChatAction => Boolean(action))
    .slice(0, 5);
  if (!answer && actions.length === 0) throw new Error('行程助手没有给出回答，请换个说法。');
  return { answer, actions };
}

export async function sendTripChat(input: { tripId: string; messages: TripChatMessage[]; planIds: string[]; memberIds: string[]; locale: 'zh-CN' | 'en' }) {
  const data = await invokeEdgeFunction<unknown>('ask-trip', { tripId: input.tripId, messages: input.messages.slice(-12), locale: input.locale });
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
