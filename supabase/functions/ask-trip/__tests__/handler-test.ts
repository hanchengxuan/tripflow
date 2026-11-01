const tripId = '11111111-1111-4111-8111-111111111111';
const originalFetch = globalThis.fetch;
const mockFetch = jest.fn<Promise<Response>, [input: RequestInfo | URL, init?: RequestInit]>();
const environment: Record<string, string> = { GEMINI_API_KEY: 'synthetic-key', SUPABASE_ANON_KEY: 'synthetic-public-key', SUPABASE_URL: 'https://synthetic.supabase.invalid' };
Object.defineProperty(globalThis, 'Deno', { configurable: true, value: { env: { get: (name: string) => environment[name] }, serve: jest.fn() } });
const { handleRequest } = jest.requireActual<typeof import('../index')>('../index');

const trip = { id: tripId, name: 'Synthetic trip', starts_on: '2026-11-01', ends_on: '2026-11-30', default_time_zone: 'Asia/Tokyo', home_currency: 'JPY' };
const plan = { id: 'lunch', kind: 'food', title: 'Lunch', starts_at: '2026-11-14T03:00:00Z', ends_at: '2026-11-14T04:00:00Z', location_label: 'Tokyo', destination_city_name: 'Tokyo', destination_time_zone: 'Asia/Tokyo', google_place_id: 'lunch-place', segment_id: null };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const model = (parts: Record<string, unknown>[]) => json({ candidates: [{ finishReason: 'STOP', content: { role: 'model', parts } }] });
const call = (name: string, args: Record<string, unknown> = {}) => ({ functionCall: { name, args } });
const request = (body: unknown = { tripId, messages: [{ role: 'user', text: 'Move lunch one hour later' }], locale: 'en' }, authorization = 'Bearer synthetic-user-session') => new Request('https://synthetic.invalid/ask-trip', { method: 'POST', headers: { Authorization: authorization }, body: JSON.stringify(body) });

function fixture(rounds: Record<string, unknown>[][], options: { outsider?: boolean; expenseFailure?: boolean; manyPlans?: boolean; manyExpenses?: boolean } = {}) {
  let round = 0;
  mockFetch.mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes('/auth/v1/user')) return json({ id: 'me' });
    if (url.includes('/rest/v1/trips?')) return json(options.outsider ? [] : [trip]);
    if (url.includes('/rest/v1/itinerary_items?')) return json(options.manyPlans ? Array.from({ length: 151 }, (_, index) => ({ ...plan, id: `plan-${index}` })) : [plan]);
    if (url.includes('/rest/v1/trip_members?')) return json([{ user_id: 'me', role: 'editor' }]);
    if (url.includes('/rest/v1/profiles?')) return json([{ id: 'me', display_name: 'Synthetic traveller' }]);
    if (url.includes('/rest/v1/expenses?')) return options.expenseFailure ? json({}, 503) : json(options.manyExpenses ? Array.from({ length: 61 }, () => ({ title: 'Synthetic expense', currency: 'JPY', total_minor: 100, occurred_at: '2026-11-14T03:00:00Z', expense_payers: [{ user_id: 'me' }] })) : []);
    if (url.includes('generativelanguage.googleapis.com')) return model(rounds[round++] ?? [{ text: 'Prepared a suggestion. Please confirm.' }]);
    throw new Error(`Unexpected network request ${url}`);
  });
}

beforeEach(() => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch;
  jest.spyOn(console, 'info').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => { globalThis.fetch = originalFetch; jest.restoreAllMocks(); });

test('the HTTP entry authenticates, scopes reads, continues tool results and returns a pending card without writes', async () => {
  fixture([[call('get_itinerary')], [call('update_plan', { itemId: 'lunch', startLocal: '2026-11-14 13:00' })]]);
  const response = await handleRequest(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ actions: [{ type: 'update_plan', itemId: 'lunch', startLocal: '2026-11-14 13:00', before: { title: 'Lunch', startsAt: plan.starts_at, timeZone: 'Asia/Tokyo' } }], run: { status: 'completed', steps: 3, toolCalls: 2 } });
  const databaseReads = mockFetch.mock.calls.filter(([url]) => String(url).includes('/rest/'));
  expect(databaseReads.every(([url]) => String(url).includes('/profiles?') || String(url).includes(`eq.${tripId}`))).toBe(true);
  expect(databaseReads.every(([, init]) => new Headers(init?.headers).get('Authorization') === 'Bearer synthetic-user-session')).toBe(true);
  expect(mockFetch.mock.calls.some(([url]) => String(url).includes('/rpc/'))).toBe(false);
  const generations = mockFetch.mock.calls.filter(([url]) => String(url).includes('generativelanguage.googleapis.com'));
  const second = JSON.parse(String(generations[1][1]?.body));
  expect(second.contents.at(-1).parts[0].functionResponse).toMatchObject({ name: 'get_itinerary', response: { items: [expect.objectContaining({ id: 'lunch' })] } });
  expect(JSON.parse(String(generations[0][1]?.body)).systemInstruction.parts[0].text).not.toContain('Synthetic traveller');
});

test('an outsider never reaches the provider or trip resource reads', async () => {
  fixture([], { outsider: true });
  expect((await handleRequest(request())).status).toBe(403);
  expect(mockFetch.mock.calls).toHaveLength(2);
  expect(mockFetch.mock.calls.some(([url]) => String(url).includes('generativelanguage'))).toBe(false);
});

test('a missing bearer token is rejected before any read or provider work', async () => {
  expect((await handleRequest(request(undefined, ''))).status).toBe(401);
  expect(mockFetch).not.toHaveBeenCalled();
});

test('optional expense read failure returns an error to the model instead of an empty ledger', async () => {
  fixture([[call('get_recent_expenses')], [{ text: 'Expenses are unavailable.' }]], { expenseFailure: true });
  const response = await handleRequest(request());
  expect(await response.json()).toMatchObject({ run: { status: 'limited' }, actions: [] });
  const generations = mockFetch.mock.calls.filter(([url]) => String(url).includes('generativelanguage'));
  expect(JSON.parse(String(generations[1][1]?.body)).contents.at(-1).parts[0].functionResponse.response).toMatchObject({ status: 'error', message: expect.stringContaining('not treat this as an empty ledger') });
});

test('cap-plus-one queries report incomplete coverage and return only the supported snapshot', async () => {
  fixture([[call('get_itinerary'), call('get_recent_expenses')], [{ text: 'Only recent records are available.' }]], { manyPlans: true, manyExpenses: true });
  expect(await (await handleRequest(request())).json()).toMatchObject({ run: { status: 'limited' } });
  const generations = mockFetch.mock.calls.filter(([url]) => String(url).includes('generativelanguage'));
  const results = JSON.parse(String(generations[1][1]?.body)).contents.at(-1).parts.map((part: { functionResponse: { response: unknown } }) => part.functionResponse.response);
  expect(results).toEqual([expect.objectContaining({ coverage: 'limited', items: expect.any(Array) }), expect.objectContaining({ coverage: 'limited', items: expect.any(Array) })]);
  expect(mockFetch.mock.calls.some(([url]) => String(url).includes('limit=151'))).toBe(true);
  expect(mockFetch.mock.calls.some(([url]) => String(url).includes('limit=61'))).toBe(true);
});

test('transcription keeps its cancellation scope alive until the provider responds', async () => {
  fixture([]);
  const normal = mockFetch.getMockImplementation();
  let complete: (() => void) | undefined;
  let providerSignal: AbortSignal | null | undefined;
  mockFetch.mockImplementation(async (input, init) => {
    if (String(input).includes('generativelanguage')) {
      providerSignal = init?.signal;
      return new Promise<Response>((resolve) => { complete = () => resolve(model([{ text: 'Move lunch' }])); });
    }
    if (!normal) throw new Error('Missing fixture');
    return normal(input, init);
  });
  const controller = new AbortController();
  const body = JSON.stringify({ tripId, mode: 'transcribe', audioBase64: 'AAA', audioMimeType: 'audio/webm' });
  const response = handleRequest(new Request('https://synthetic.invalid', { method: 'POST', headers: { Authorization: 'Bearer synthetic-user-session' }, body, signal: controller.signal }));
  for (let index = 0; index < 30 && !complete; index += 1) await new Promise<void>((resolve) => setTimeout(resolve, 0));
  expect(complete).toBeDefined();
  expect(providerSignal?.aborted).toBe(false);
  controller.abort();
  expect(providerSignal?.aborted).toBe(true);
  complete?.();
  expect((await response).status).toBe(504);
});
