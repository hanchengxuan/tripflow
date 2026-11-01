import { zonedDateTimeToIso } from '../_shared/trip-time.ts';

const currencies = ['CNY', 'HKD', 'JPY', 'USD', 'EUR', 'AUD', 'GBP', 'KRW', 'SGD', 'TWD', 'MOP'];
const kinds = ['transport', 'lodging', 'food', 'activity', 'note', 'task'];

export type TripChatAction =
  | { type: 'update_plan'; itemId: string; title?: string; startLocal?: string; endLocal?: string; before?: { title: string; startsAt: string; endsAt?: string; timeZone: string } }
  | { type: 'add_plan'; kind: string; title: string; startLocal: string; endLocal: string; place?: string }
  | { type: 'add_expense'; title: string; amount: string; currency: string; payerUserId?: string; participantUserIds?: string[] };

export interface AgentPlan {
  id: string;
  kind: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  starts: string;
  ends: string | null;
  timeZone: string;
  place: string | null;
  placeId: string | null;
  city: string | null;
  segmentId: string | null;
}

export interface AgentContext {
  trip: { name: string; startsOn: string; endsOn: string; timeZone: string; homeCurrency: string };
  now: string;
  members: { id: string; name: string; role: string; isMe: boolean }[];
  plans: AgentPlan[];
  recentExpenses: { title: string; amount: string; currency: string; paidBy: string[]; date: string }[] | null;
  coverage: { plans: 'complete' | 'limited'; expenses: 'complete' | 'limited' | 'unavailable' };
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Arguments must be an object.');
  return value as Record<string, unknown>;
}

function string(value: unknown, max: number) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new Error('A required text field is missing or too long.');
  return value.trim();
}

function local(value: unknown) {
  const result = string(value, 16);
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(result)
    || new Date(`${result.replace(' ', 'T')}:00Z`).toISOString().slice(0, 16) !== result.replace(' ', 'T')) {
    throw new Error('Use a real calendar date and time in YYYY-MM-DD HH:mm format.');
  }
  return result;
}

function iso(value: string, timeZone: string) {
  const result = zonedDateTimeToIso(value.slice(0, 10), value.slice(11), timeZone);
  const parts = new Intl.DateTimeFormat('sv-SE', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(result));
  if (parts !== value) throw new Error('That local time does not exist in this time zone.');
  return result;
}

function page<T>(items: T[], args: Record<string, unknown>, coverage: string) {
  const offset = args.offset === undefined ? 0 : args.offset;
  if (typeof offset !== 'number' || !Number.isInteger(offset) || offset < 0 || offset > items.length) throw new Error('Invalid page offset.');
  const end = offset + 25;
  return { items: items.slice(offset, end), nextOffset: end < items.length ? end : null, coverage };
}

function definition(description: string, properties: Record<string, unknown>, required: string[] = []) {
  return { description, parameters: { type: 'object', properties, ...(required.length ? { required } : {}) } };
}

const textField = { type: 'string' };
const tools = {
  get_itinerary: definition('Read visible plans, optionally matching a title or local date. Lodging overlapping a date is included. Results are paginated and coverage may be limited. Never infer absence outside coverage.', {
    query: textField, date: { type: 'string', description: 'YYYY-MM-DD in each plan time zone' }, offset: { type: 'integer' },
  }),
  get_members: definition('Read this trip\'s travellers, roles and IDs. isMe identifies the authenticated traveller.', {}),
  get_recent_expenses: definition('Read recent expenses in their original currencies. This is not the full ledger, balances, debt or settlement. Do not infer what anyone owes.', { offset: { type: 'integer' } }),
  search_places: definition('Search Google Places by name or address. Include city/country to disambiguate. Results are suggestions, not opening hours, prices or recommendations.', { query: textField }, ['query']),
  estimate_route: definition('Estimate a route between Place IDs from visible plans or search_places results. Does not save a route. Estimates may use current conditions, not the itinerary date.', {
    originPlaceId: textField, destinationPlaceId: textField, travelMode: { type: 'string', enum: ['DRIVE', 'TRANSIT', 'WALK', 'BICYCLE'] },
  }, ['originPlaceId', 'destinationPlaceId', 'travelMode']),
  update_plan: definition('Stage a change to one existing plan for traveller confirmation. Does NOT save. Only include changed fields. Times use the plan time zone. A moved start keeps duration unless endLocal is explicit.', {
    itemId: textField, title: textField, startLocal: textField, endLocal: textField,
  }, ['itemId']),
  add_plan: definition('Stage a new plan for traveller confirmation. Does NOT save. Times use the trip time zone. Only use facts supplied by the traveller or tools.', {
    kind: { type: 'string', enum: kinds }, title: textField, startLocal: textField, endLocal: textField, place: textField,
  }, ['kind', 'title', 'startLocal', 'endLocal']),
  add_expense: definition('Stage an expense draft. Does NOT save. Amount is a decimal string. Omit payer/participants only when unspecified by the traveller. Use exact member IDs.', {
    title: textField, amount: textField, currency: { type: 'string', enum: currencies }, payerUserId: textField, participantUserIds: { type: 'array', items: textField },
  }, ['title', 'amount', 'currency']),
};

export function createTripTools(context: AgentContext, external: (name: 'places-autocomplete' | 'route-estimate', body: Record<string, unknown>) => Promise<unknown>) {
  const actions: TripChatAction[] = [];
  const knownPlaces = new Set(context.plans.flatMap(({ placeId }) => placeId ? [placeId] : []));
  const members = new Set(context.members.map(({ id }) => id));
  const canEdit = context.members.some(({ role, isMe }) => isMe && (role === 'owner' || role === 'editor'));
  const declarations = Object.entries(tools).map(([name, value]) => ({ name, ...value }));

  const stage = (action: TripChatAction) => {
    const duplicate = actions.find((existing) => JSON.stringify(existing) === JSON.stringify(action));
    if (!duplicate) {
      if (action.type === 'update_plan') {
        const previous = actions.findIndex((existing) => existing.type === 'update_plan' && existing.itemId === action.itemId);
        if (previous >= 0) actions.splice(previous, 1);
      }
      if (actions.length >= 5) throw new Error('Only five proposals fit in one reply. Narrow the request.');
      actions.push(action);
    }
    return { status: 'pending_confirmation', action, saved: false };
  };

  const interval = (action: Extract<TripChatAction, { type: 'update_plan' | 'add_plan' }>) => {
    const item = action.type === 'update_plan' ? context.plans.find(({ id }) => id === action.itemId) : undefined;
    if (action.type === 'update_plan' && !item) throw new Error('Plan ID is not in the visible itinerary. Call get_itinerary or ask for clarification.');
    const timeZone = item?.timeZone ?? context.trip.timeZone;
    const start = action.startLocal ? iso(action.startLocal, timeZone) : item?.startsAt;
    if (!start) throw new Error('Start time is required.');
    const end = action.endLocal ? iso(action.endLocal, timeZone)
      : item?.endsAt ? new Date(new Date(item.endsAt).getTime() + new Date(start).getTime() - new Date(item.startsAt).getTime()).toISOString() : undefined;
    if (!end || new Date(end).getTime() <= new Date(start).getTime()) throw new Error('End must be after start. Ask for an explicit end time if needed.');
    const day = (value: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: context.trip.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
    if (day(start) < context.trip.startsOn || day(end) > context.trip.endsOn) throw new Error('The proposed time is outside the trip dates. Ask the traveller to extend the trip first.');
    return { start, end, item };
  };

  async function execute(name: string, rawArgs: unknown): Promise<Record<string, unknown>> {
    try {
      if (!(name in tools) || !Object.hasOwn(tools, name)) throw new Error('Unknown tool. Choose one of the declared tools.');
      const args = record(rawArgs);
      const schema = tools[name as keyof typeof tools].parameters;
      if (Object.keys(args).some((key) => !Object.hasOwn(schema.properties, key))) throw new Error('Unsupported argument. Use only declared fields.');
      if (name === 'get_itinerary') {
        const query = args.query === undefined ? '' : string(args.query, 120).toLocaleLowerCase();
        const date = args.date === undefined ? undefined : local(`${string(args.date, 10)} 00:00`).slice(0, 10);
        const items = context.plans.filter((item) => (!query || `${item.title} ${item.place ?? ''} ${item.city ?? ''}`.toLocaleLowerCase().includes(query))
          && (!date || item.starts.slice(0, 10) <= date && (item.ends ?? item.starts).slice(0, 10) >= date));
        return { status: 'ok', ...page(items, args, context.coverage.plans) };
      }
      if (name === 'get_members') return { status: 'ok', members: context.members };
      if (name === 'get_recent_expenses') {
        if (!context.recentExpenses) throw new Error('Expenses could not be read. Do not treat this as an empty ledger.');
        return { status: 'ok', ...page(context.recentExpenses, args, context.coverage.expenses) };
      }
      if (name === 'search_places') {
        const query = string(args.query, 120);
        if (query.length < 3) throw new Error('Include the city or country so the place query has at least three characters.');
        const response = record(await external('places-autocomplete', { input: query }));
        if (!Array.isArray(response.suggestions)) throw new Error('Place lookup returned an invalid result.');
        const suggestions = response.suggestions.slice(0, 5).map((value) => {
          const suggestion = record(value);
          const placeId = string(suggestion.placeId, 300);
          knownPlaces.add(placeId);
          return { placeId, text: string(suggestion.text, 500) };
        });
        return { status: 'ok', suggestions };
      }
      if (name === 'estimate_route') {
        const originPlaceId = string(args.originPlaceId, 300);
        const destinationPlaceId = string(args.destinationPlaceId, 300);
        const travelMode = string(args.travelMode, 10);
        if (!knownPlaces.has(originPlaceId) || !knownPlaces.has(destinationPlaceId)) throw new Error('Use Place IDs returned by get_itinerary or search_places first.');
        if (!['DRIVE', 'TRANSIT', 'WALK', 'BICYCLE'].includes(travelMode)) throw new Error('Invalid travel mode.');
        const response = record(await external('route-estimate', { originPlaceId, destinationPlaceId, travelMode }));
        if (response.route === undefined) throw new Error('Route lookup returned an invalid result.');
        if (response.route !== null) {
          const route = record(response.route);
          if (typeof route.durationSeconds !== 'number' || !Number.isFinite(route.durationSeconds) || route.durationSeconds < 0
            || typeof route.distanceMeters !== 'number' || !Number.isFinite(route.distanceMeters) || route.distanceMeters < 0) throw new Error('Route lookup returned an invalid estimate.');
        }
        return { status: 'ok', route: response.route, timing: 'Current estimate; not a guarantee for the itinerary date.' };
      }
      if (name === 'update_plan' || name === 'add_plan') {
        if (!canEdit) throw new Error('Only an owner or editor can propose itinerary changes.');
        const title = args.title === undefined ? undefined : string(args.title, 180);
        const startLocal = args.startLocal === undefined ? undefined : local(args.startLocal);
        const endLocal = args.endLocal === undefined ? undefined : local(args.endLocal);
        let action: Extract<TripChatAction, { type: 'update_plan' | 'add_plan' }>;
        if (name === 'update_plan') {
          if (!title && !startLocal && !endLocal) throw new Error('Include at least one changed field.');
          const itemId = string(args.itemId, 100);
          action = { type: name, itemId, ...(title ? { title } : {}), ...(startLocal ? { startLocal } : {}), ...(endLocal ? { endLocal } : {}) };
          const pending = actions.find((existing) => existing.type === 'update_plan' && existing.itemId === itemId);
          if (pending?.type === 'update_plan') action = { ...pending, ...action };
        } else {
          const kind = string(args.kind, 20);
          if (!kinds.includes(kind) || !title || !startLocal || !endLocal) throw new Error('Kind, title, start and end are required.');
          const place = args.place === undefined ? undefined : string(args.place, 500);
          if (kind === 'lodging' && !place) throw new Error('A hotel needs its name or address.');
          action = { type: name, kind, title, startLocal, endLocal, ...(place ? { place } : {}) };
        }
        const { start, end, item } = interval(action);
        if (action.type === 'update_plan' && item) action.before = { title: item.title, startsAt: item.startsAt, ...(item.endsAt ? { endsAt: item.endsAt } : {}), timeZone: item.timeZone };
        const kind = action.type === 'add_plan' ? action.kind : item?.kind;
        const overlaps = context.plans.filter((other) => other.id !== item?.id && other.segmentId === (item?.segmentId ?? null)
          && (other.kind === 'lodging') === (kind === 'lodging') && other.endsAt
          && new Date(other.startsAt).getTime() < new Date(end).getTime() && new Date(other.endsAt).getTime() > new Date(start).getTime())
          .map(({ id, title }) => ({ id, title }));
        return { ...stage(action), overlaps, coverage: context.coverage.plans };
      }
      const title = string(args.title, 180);
      const amount = string(args.amount, 30);
      const currency = string(args.currency, 3).toUpperCase();
      if (!currencies.includes(currency) || !/^\d+(?:\.\d{1,2})?$/.test(amount)) throw new Error('Use a supported currency and positive decimal amount.');
      const digits = currency === 'JPY' || currency === 'KRW' ? 0 : 2;
      const [whole, fraction = ''] = amount.split('.');
      const minor = Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, '0') || 0);
      if (!Number.isSafeInteger(minor) || minor <= 0
        || (currency === 'JPY' || currency === 'KRW') && amount.includes('.')) throw new Error('Amount has unsupported precision or is too large.');
      const payerUserId = args.payerUserId === undefined ? undefined : string(args.payerUserId, 100);
      if (payerUserId && !members.has(payerUserId)) throw new Error('Unknown payer. Use a member ID.');
      let participantUserIds: string[] | undefined;
      if (args.participantUserIds !== undefined) {
        if (!Array.isArray(args.participantUserIds) || args.participantUserIds.length === 0) throw new Error('Participants must be a nonempty list of member IDs.');
        participantUserIds = [...new Set(args.participantUserIds.map((value) => string(value, 100)))];
        if (participantUserIds.some((id) => !members.has(id))) throw new Error('Unknown participant. Use member IDs.');
      }
      return stage({ type: 'add_expense', title, amount, currency, ...(payerUserId ? { payerUserId } : {}), ...(participantUserIds ? { participantUserIds } : {}) });
    } catch (error) {
      return { status: 'error', message: error instanceof Error ? error.message : 'Tool unavailable. Try a narrower request.' };
    }
  }

  return { declarations, execute, actions };
}
