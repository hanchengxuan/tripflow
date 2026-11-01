import { runTripAgent } from '../agent';
import { createTripTools, type AgentContext } from '../tools';

type Generate = NonNullable<Parameters<typeof runTripAgent>[1]>;
type Part = Record<string, unknown>;
type Body = { contents: { role: string; parts: Part[] }[]; toolConfig: { functionCallingConfig: { mode: string } } };
const call = (name: string, args: unknown = {}, id = name): Part => ({ functionCall: { name, args, id } });
const final = [{ text: 'Prepared a suggestion. Please confirm it.' }];
const proposal = { itemId: 'museum', startLocal: '2026-10-05 12:00' };
const expense = { title: 'Lunch', amount: '12.50', currency: 'AUD' };
const plan = { kind: 'activity', title: 'Walk', startLocal: '2026-10-05 14:00', endLocal: '2026-10-05 15:00' };

function context(): AgentContext {
  return {
    trip: { name: 'Synthetic trip', startsOn: '2026-01-01', endsOn: '2026-12-31', timeZone: 'Australia/Sydney', homeCurrency: 'AUD' },
    now: '2026-10-01T00:00:00Z',
    members: [{ id: 'owner', name: 'Traveller A', role: 'owner', isMe: true }, { id: 'member', name: 'Traveller B', role: 'viewer', isMe: false }],
    plans: [{ id: 'museum', kind: 'activity', title: 'Museum', startsAt: '2026-10-05T00:00:00Z', endsAt: '2026-10-05T01:00:00Z', starts: '2026-10-05 11:00', ends: '2026-10-05 12:00', timeZone: 'Australia/Sydney', place: 'Museum', placeId: 'museum-place', city: 'Sydney', segmentId: null }],
    recentExpenses: [{ title: 'Coffee', amount: '5.00', currency: 'AUD', paidBy: ['owner'], date: '2026-10-01' }],
    coverage: { plans: 'complete', expenses: 'limited' },
  };
}

function generated(parts: Part[], attempts = 1, model = 'gemini-2.5-flash-lite') {
  return { response: new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { role: 'model', parts, opaque: { preserved: true } } }] })), model, attempts };
}

function harness(rounds: Part[][], trip = context()) {
  const requests: Body[] = [];
  const external = jest.fn<Promise<unknown>, Parameters<Parameters<typeof createTripTools>[1]>>(async () => { throw new Error('Unexpected external request'); });
  const generate = jest.fn<ReturnType<Generate>, Parameters<Generate>>(async (request) => {
    requests.push(JSON.parse(request.body));
    return generated(rounds[requests.length - 1] ?? final);
  });
  const input: Parameters<typeof runTripAgent>[0] = { apiKey: 'synthetic-key', context: trip, messages: [{ role: 'user', text: 'Move the museum to noon.' }], replyLanguage: 'English', signal: new AbortController().signal, external };
  return { requests, external, generate, input, run: () => runTripAgent(input, generate) };
}

function toolResults(body: Body) {
  return body.contents.flatMap(({ parts }) => parts.flatMap((part) => {
    const response = part.functionResponse;
    if (!response || typeof response !== 'object' || !('response' in response)) return [];
    return [response.response];
  }));
}

test('reads real itinerary data, proposes an edit and finishes without a save or network write', async () => {
  const h = harness([[call('get_itinerary')], [call('update_plan', proposal)], final]);
  const before = JSON.stringify(h.input.context);
  const fetch = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected network write'));
  try {
    const result = await h.run();
    expect(result.run).toEqual({ status: 'completed', steps: 3, toolCalls: 2 });
    expect(result.actions).toEqual([expect.objectContaining({ type: 'update_plan', ...proposal, before: expect.objectContaining({ title: 'Museum', startsAt: '2026-10-05T00:00:00Z', timeZone: 'Australia/Sydney' }) })]);
    expect(toolResults(h.requests[1])).toContainEqual(expect.objectContaining({ items: [expect.objectContaining({ id: 'museum' })] }));
    expect(toolResults(h.requests[2])).toContainEqual(expect.objectContaining({ status: 'pending_confirmation', saved: false }));
    expect(JSON.stringify(h.input.context)).toBe(before);
    expect(fetch).not.toHaveBeenCalled();
    expect(h.external).not.toHaveBeenCalled();
  } finally { fetch.mockRestore(); }
});

test('replays the full signed model content and returns matching tool IDs in call order', async () => {
  const parts = [{ text: 'private reasoning', thought: true, thoughtSignature: 'opaque-text-signature' }, { ...call('get_members', {}, 'second'), thoughtSignature: 'opaque-call-signature', providerMetadata: { x: 1 } }, call('get_itinerary', {}, 'first')];
  const h = harness([parts, [{ text: 'Hidden', thought: true }, { text: 'Visible answer' }]]);
  expect((await h.run()).answer).toBe('Visible answer');
  expect(h.requests[1].contents[1]).toEqual({ role: 'model', parts, opaque: { preserved: true } });
  expect(h.requests[1].contents[2].parts).toEqual([
    { functionResponse: { name: 'get_members', id: 'second', response: { status: 'ok', members: h.input.context.members } } },
    { functionResponse: { name: 'get_itinerary', id: 'first', response: expect.objectContaining({ items: h.input.context.plans }) } },
  ]);
});

test('pins an initially selected fallback for every continuation', async () => {
  const h = harness([[call('get_members')], [call('get_itinerary')], final]);
  await h.run();
  expect(h.generate.mock.calls.map(([request]) => ({ model: request.model, allowFallback: request.allowFallback }))).toEqual([
    { model: undefined, allowFallback: true }, { model: 'gemini-2.5-flash-lite', allowFallback: false }, { model: 'gemini-2.5-flash-lite', allowFallback: false },
  ]);
});

test('provider failure after staging keeps the card and truthfully reports it remains unsaved', async () => {
  const h = harness([[call('add_expense', expense)]]);
  h.generate.mockImplementationOnce(async () => generated([call('add_expense', expense)])).mockRejectedValueOnce(new Error('Provider unavailable'));
  const result = await h.run();
  expect(result.actions).toEqual([{ type: 'add_expense', ...expense }]);
  expect(result.run.status).toBe('limited');
  expect(result.answer).toMatch(/confirmation.*Nothing has been saved/);
  expect(h.external).not.toHaveBeenCalled();
});

test('unknown tools and malformed arguments return errors the model can correct', async () => {
  const h = harness([[call('delete_trip'), call('update_plan', []), call('get_members', { secrets: true })], [call('get_members')], final]);
  const result = await h.run();
  expect(toolResults(h.requests[1])).toEqual(Array.from({ length: 3 }, () => expect.objectContaining({ status: 'error' })));
  expect(toolResults(h.requests[2])).toContainEqual({ status: 'ok', members: h.input.context.members });
  expect(result.actions).toEqual([]);
  expect(result.run).toEqual({ status: 'limited', steps: 3, toolCalls: 4 });
});

test('a model that keeps reading stops after six generations and disables final tool calls', async () => {
  const h = harness(Array.from({ length: 8 }, () => [call('get_members')]));
  const result = await h.run();
  expect(result.run).toEqual({ status: 'limited', steps: 6, toolCalls: 5 });
  expect(h.generate).toHaveBeenCalledTimes(6);
  expect(h.requests[5].toolConfig.functionCallingConfig.mode).toBe('NONE');
  expect(result.answer).toMatch(/Nothing has been saved/);
});

test('a large tool batch executes at most twelve tools and exposes budget errors', async () => {
  const h = harness([Array.from({ length: 20 }, (_, index) => call('get_members', {}, String(index))), final]);
  const result = await h.run();
  expect(result.run).toEqual({ status: 'limited', steps: 2, toolCalls: 12 });
  expect(toolResults(h.requests[1]).filter((value) => value && typeof value === 'object' && 'status' in value && value.status === 'error')).toHaveLength(8);
  expect(h.requests[1].toolConfig.functionCallingConfig.mode).toBe('NONE');
});

test('the shared provider budget never allows more than eight attempts', async () => {
  const h = harness([]);
  h.generate.mockImplementation(async (request) => generated([call('get_members')], request.maxAttempts));
  const result = await h.run();
  expect(h.generate.mock.calls.map(([request]) => request.maxAttempts)).toEqual([3, 3, 2]);
  expect(result.run).toEqual({ status: 'limited', steps: 3, toolCalls: 3 });
});

test('repeated expensive reads are cached while correcting back to an earlier proposal stays current', async () => {
  const h = harness([[call('search_places', { query: 'Sydney museum' }), call('update_plan', proposal)], [call('search_places', { query: 'Sydney museum' }), call('update_plan', { ...proposal, startLocal: '2026-10-05 13:00' })], [call('update_plan', proposal)], final]);
  h.external.mockResolvedValue({ suggestions: [{ placeId: 'new-place', text: 'Museum, Sydney' }] });
  const result = await h.run();
  expect(h.external).toHaveBeenCalledTimes(1);
  expect(result.actions).toEqual([expect.objectContaining({ type: 'update_plan', ...proposal })]);
  expect(toolResults(h.requests[3])).toContainEqual(expect.objectContaining({ status: 'pending_confirmation', action: expect.objectContaining(proposal) }));
});

test('sequential changes to different fields merge into one fully validated proposal', async () => {
  const h = harness([[call('update_plan', { itemId: 'museum', title: 'Art museum' })], [call('update_plan', proposal)], final]);
  const result = await h.run();
  expect(result.actions).toEqual([expect.objectContaining({ type: 'update_plan', title: 'Art museum', ...proposal })]);
  expect(toolResults(h.requests[2])).toContainEqual(expect.objectContaining({ action: expect.objectContaining({ title: 'Art museum', ...proposal }) }));
});

test('the photo belongs only to the latest user turn and is replayed once per continuation', async () => {
  const h = harness([[call('get_members')], final]);
  h.input.messages = [{ role: 'user', text: 'Old receipt' }, { role: 'assistant', text: 'Please send a photo' }, { role: 'user', text: 'This receipt' }];
  h.input.image = { base64: 'synthetic-image', mimeType: 'image/jpeg' };
  await h.run();
  for (const request of h.requests) {
    const imageParts = request.contents.flatMap(({ parts }) => parts.filter((part) => part.inlineData));
    expect(imageParts).toEqual([{ inlineData: { data: 'synthetic-image', mimeType: 'image/jpeg' } }]);
    expect(request.contents.slice(0, 2).flatMap(({ parts }) => parts).every((part) => !part.inlineData)).toBe(true);
    expect(request.contents[2].parts).toEqual([{ inlineData: { data: 'synthetic-image', mimeType: 'image/jpeg' } }, { text: 'This receipt' }]);
  }
});

test('Places then Routes then a proposal uses only the fixed authorized external arguments', async () => {
  const route = { originPlaceId: 'museum-place', destinationPlaceId: 'harbour-place', travelMode: 'WALK' };
  const h = harness([[call('get_itinerary'), call('search_places', { query: 'Sydney Harbour' })], [call('estimate_route', route)], [call('add_plan', plan)], final]);
  h.external.mockResolvedValueOnce({ suggestions: [{ placeId: 'harbour-place', text: 'Harbour, Sydney' }] }).mockResolvedValueOnce({ route: { durationSeconds: 1200, distanceMeters: 1500 } });
  const result = await h.run();
  expect(h.external.mock.calls).toEqual([['places-autocomplete', { input: 'Sydney Harbour' }], ['route-estimate', route]]);
  expect(toolResults(h.requests[2])).toContainEqual(expect.objectContaining({ route: { durationSeconds: 1200, distanceMeters: 1500 }, timing: expect.stringContaining('not a guarantee') }));
  expect(result.actions).toEqual([{ type: 'add_plan', ...plan }]);
  expect(toolResults(h.requests[3])).toContainEqual(expect.objectContaining({ saved: false, status: 'pending_confirmation' }));
});

test.each([
  ['invalid calendar date', 'add_plan', { ...plan, startLocal: '2026-02-30 12:00' }],
  ['rolled over clock time', 'add_plan', { ...plan, startLocal: '2026-10-05 25:00' }],
  ['spring DST gap', 'add_plan', { ...plan, startLocal: '2026-10-04 02:30', endLocal: '2026-10-04 04:00' }],
  ['end before start', 'add_plan', { ...plan, endLocal: '2026-10-05 13:00' }],
  ['outside trip dates', 'add_plan', { ...plan, startLocal: '2027-01-01 10:00', endLocal: '2027-01-01 11:00' }],
  ['unknown plan', 'update_plan', { ...proposal, itemId: 'invisible' }],
  ['unsupported currency', 'add_expense', { ...expense, currency: 'BTC' }],
  ['fractional yen', 'add_expense', { ...expense, currency: 'JPY', amount: '12.50' }],
  ['zero amount', 'add_expense', { ...expense, amount: '0' }],
  ['excess decimal precision', 'add_expense', { ...expense, amount: '12.501' }],
  ['unknown payer', 'add_expense', { ...expense, payerUserId: 'stranger' }],
  ['unknown participant', 'add_expense', { ...expense, participantUserIds: ['stranger'] }],
  ['empty participants', 'add_expense', { ...expense, participantUserIds: [] }],
])('%s cannot produce a confirmation card', async (_label, name, args) => {
  const tools = createTripTools(context(), async () => { throw new Error('Unexpected external request'); });
  expect(await tools.execute(name, args)).toEqual(expect.objectContaining({ status: 'error' }));
  expect(tools.actions).toEqual([]);
});

test('existing plans use their own time zone when checking nonexistent local times', async () => {
  const trip = context();
  trip.trip.timeZone = 'Asia/Tokyo';
  const tools = createTripTools(trip, async () => ({}));
  expect(await tools.execute('update_plan', { ...proposal, startLocal: '2026-10-04 02:30', endLocal: '2026-10-04 04:00' })).toEqual(expect.objectContaining({ status: 'error', message: expect.stringContaining('does not exist') }));
  expect(await tools.execute('add_plan', { ...plan, startLocal: '2026-10-04 02:30', endLocal: '2026-10-04 04:00' })).toEqual(expect.objectContaining({ status: 'pending_confirmation', saved: false }));
});

test('viewer permissions reject itinerary proposals while member expense drafts remain pending', async () => {
  const trip = context();
  trip.members[0].role = 'viewer';
  const tools = createTripTools(trip, async () => ({}));
  expect(await tools.execute('update_plan', proposal)).toEqual(expect.objectContaining({ status: 'error' }));
  expect(await tools.execute('add_plan', plan)).toEqual(expect.objectContaining({ status: 'error' }));
  expect(await tools.execute('add_expense', { ...expense, payerUserId: 'owner', participantUserIds: ['owner', 'member', 'owner'] })).toEqual(expect.objectContaining({ status: 'pending_confirmation', saved: false }));
  expect(tools.actions).toEqual([{ type: 'add_expense', ...expense, payerUserId: 'owner', participantUserIds: ['owner', 'member'] }]);
});

test('missing expenses remain unavailable and limited itinerary pages expose their coverage', async () => {
  const trip = context();
  trip.recentExpenses = null;
  trip.coverage = { plans: 'limited', expenses: 'unavailable' };
  const h = harness([[call('get_recent_expenses'), call('get_itinerary')], final], trip);
  const result = await h.run();
  expect(toolResults(h.requests[1])).toEqual([expect.objectContaining({ status: 'error', message: expect.stringContaining('not treat this as an empty ledger') }), expect.objectContaining({ status: 'ok', coverage: 'limited', items: trip.plans })]);
  expect(result.run.status).toBe('limited');
});

test('route estimates reject unknown IDs and injected external arguments before invoking a provider', async () => {
  const external = jest.fn(async () => ({}));
  const tools = createTripTools(context(), external);
  expect(await tools.execute('estimate_route', { originPlaceId: 'guessed', destinationPlaceId: 'museum-place', travelMode: 'WALK' })).toEqual(expect.objectContaining({ status: 'error' }));
  expect(await tools.execute('search_places', { query: 'Museum', url: 'https://attacker.invalid' })).toEqual(expect.objectContaining({ status: 'error' }));
  expect(external).not.toHaveBeenCalled();
});

test('invalid time zones fail closed instead of staging UTC guesses', async () => {
  const trip = context();
  trip.trip.timeZone = 'Not/AZone';
  const tools = createTripTools(trip, async () => ({}));
  expect(await tools.execute('add_plan', plan)).toEqual(expect.objectContaining({ status: 'error' }));
  expect(tools.actions).toEqual([]);
});

test('overlap warnings respect hotel intervals and separate branches', async () => {
  const trip = context();
  const original = trip.plans[0];
  trip.plans.push(
    { ...original, id: 'hotel', kind: 'lodging', title: 'Hotel', startsAt: '2026-10-04T04:00:00Z', endsAt: '2026-10-06T00:00:00Z' },
    { ...original, id: 'parallel', segmentId: 'other-branch', title: 'Branch walk' },
  );
  const tools = createTripTools(trip, async () => ({}));
  expect(await tools.execute('add_plan', { ...plan, startLocal: '2026-10-05 11:30', endLocal: '2026-10-05 12:30' })).toEqual(expect.objectContaining({ status: 'pending_confirmation', saved: false, overlaps: [{ id: 'museum', title: 'Museum' }] }));
});

test('pages make remaining visible plans discoverable without implying complete trip coverage', async () => {
  const trip = context();
  trip.plans = Array.from({ length: 26 }, (_, index) => ({ ...trip.plans[0], id: `plan-${index}` }));
  trip.coverage.plans = 'limited';
  const tools = createTripTools(trip, async () => ({}));
  expect(await tools.execute('get_itinerary', {})).toEqual(expect.objectContaining({ items: trip.plans.slice(0, 25), nextOffset: 25, coverage: 'limited' }));
  expect(await tools.execute('get_itinerary', { offset: 25 })).toEqual(expect.objectContaining({ items: [trip.plans[25]], nextOffset: null, coverage: 'limited' }));
});

test('duplicate proposals do not consume the five-card limit and excess cards fail without mutation', async () => {
  const tools = createTripTools(context(), async () => ({}));
  for (let index = 0; index < 5; index += 1) await tools.execute('add_expense', { ...expense, title: `Meal ${index}` });
  expect(await tools.execute('add_expense', { ...expense, title: 'Meal 0' })).toEqual(expect.objectContaining({ status: 'pending_confirmation', saved: false }));
  expect(await tools.execute('add_expense', { ...expense, title: 'Sixth meal' })).toEqual(expect.objectContaining({ status: 'error' }));
  expect(tools.actions.map(({ title }) => title)).toEqual(['Meal 0', 'Meal 1', 'Meal 2', 'Meal 3', 'Meal 4']);
});

test('an incomplete provider candidate cannot execute its proposed calls', async () => {
  const h = harness([]);
  h.generate.mockResolvedValueOnce({ response: new Response(JSON.stringify({ candidates: [{ finishReason: 'MAX_TOKENS', content: { role: 'model', parts: [call('add_expense', expense)] } }] })), model: 'gemini-2.5-flash-lite', attempts: 1 });
  const result = await h.run();
  expect(result.actions).toEqual([]);
  expect(result.run).toEqual({ status: 'limited', steps: 1, toolCalls: 0 });
  expect(result.answer).toMatch(/Nothing has been saved/);
});
