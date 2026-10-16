let handler: (request: Request) => Promise<Response>;
const mockFetch = jest.fn();
const tripId = '00000000-0000-4000-8000-000000000001';
const userId = '00000000-0000-4000-8000-000000000002';
const originalFetch = globalThis.fetch;

beforeAll(() => {
  Object.defineProperty(globalThis, 'Deno', { configurable: true, value: {
    env: { get: (name: string) => {
      const values: Record<string, string> = { SUPABASE_URL: 'https://test.invalid', SUPABASE_ANON_KEY: 'test-key', GEMINI_API_KEY: 'test-gemini' };
      return values[name];
    } },
    serve: (callback: typeof handler) => { handler = callback; },
  } });
  jest.isolateModules(() => { jest.requireActual('../../../../supabase/functions/parse-booking/index'); });
  globalThis.fetch = mockFetch;
});
afterAll(() => { globalThis.fetch = originalFetch; Reflect.deleteProperty(globalThis, 'Deno'); });
beforeEach(() => mockFetch.mockReset());

function request(body: object, auth = 'Bearer test') {
  return new Request('https://test.invalid/parse-booking', { method: 'POST', headers: auth ? { Authorization: auth } : {}, body: JSON.stringify(body) });
}
function respond(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status }); }
function auth(role = 'editor') {
  mockFetch.mockResolvedValueOnce(respond({ id: userId })).mockResolvedValueOnce(respond([{ user_id: userId, role }]));
}
const body = { tripId, consent: true, base64: btoa('%PDF-1.7\n'), mimeType: 'application/pdf', locale: 'en' };

test('unauthenticated and expired bearer requests never reach Gemini', async () => {
  expect((await handler(request(body, ''))).status).toBe(401);
  expect(mockFetch).not.toHaveBeenCalled();
  mockFetch.mockResolvedValueOnce(respond({}, 401));
  expect((await handler(request(body))).status).toBe(401);
  expect(mockFetch).toHaveBeenCalledTimes(1);
});
test('viewer and outsider requests do not process documents', async () => {
  auth('viewer');
  expect((await handler(request(body))).status).toBe(403);
  expect(mockFetch).toHaveBeenCalledTimes(2);
  mockFetch.mockReset();
  mockFetch.mockResolvedValueOnce(respond({ id: userId })).mockResolvedValueOnce(respond([]));
  expect((await handler(request(body))).status).toBe(403);
  expect(mockFetch).toHaveBeenCalledTimes(2);
});
test('processing requires explicit consent and matching file content', async () => {
  mockFetch.mockResolvedValueOnce(respond({ id: userId }));
  expect((await handler(request({ ...body, consent: false }))).status).toBe(400);
  expect(mockFetch).toHaveBeenCalledTimes(1);
  mockFetch.mockReset(); auth();
  expect((await handler(request({ ...body, mimeType: 'image/png' }))).status).toBe(400);
  expect(mockFetch).toHaveBeenCalledTimes(2);
});
test('recognized unknown fields stay empty; output is a preview with no database writes', async () => {
  auth();
  mockFetch.mockResolvedValueOnce(respond({ candidates: [{ content: { parts: [{ text: JSON.stringify({ bookings: [{ kind: 'hotel', title: 'Demo hotel', location: 'Tokyo', warnings: ['Check-in time missing'] }] }) }] } }] }));
  const response = await handler(request(body));
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.bookings[0].startLocal).toBe('');
  expect(result.bookings[0].startTimeZone).toBe('');
  expect(mockFetch).toHaveBeenCalledTimes(3);
  expect(mockFetch.mock.calls.every(([url, init]) => !String(url).includes('/rpc/') && (!init?.method || init.method === 'POST'))).toBe(true);
});
test('provider and malformed structured-output failures are recoverable', async () => {
  auth(); mockFetch.mockImplementation(async () => respond({}, 503));
  expect((await handler(request(body))).status).toBe(502);
  mockFetch.mockReset(); auth(); mockFetch.mockResolvedValueOnce(respond({ candidates: [{ content: { parts: [{ text: 'not JSON' }] } }] }));
  expect((await handler(request(body))).status).toBe(502);
});

test('an overloaded booking model falls back and returns a reviewable draft', async () => {
  auth();
  mockFetch.mockResolvedValueOnce(respond({}, 503)).mockResolvedValueOnce(respond({ candidates: [{ content: { parts: [{ text: '{"bookings":[]}' }] } }] }));
  const response = await handler(request(body));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ bookings: [], model: 'gemini-2.5-flash-lite' });
  expect(mockFetch.mock.calls.slice(2).map(([url]) => String(url))).toEqual([
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent',
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent',
  ]);
});
