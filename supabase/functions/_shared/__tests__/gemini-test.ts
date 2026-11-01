import { generateGemini } from '../gemini';

const originalFetch = globalThis.fetch;
const mockFetch = jest.fn<Promise<Response>, [input: RequestInfo | URL, init?: RequestInit]>();
const body = JSON.stringify({ contents: [{ parts: [{ text: 'Synthetic acceptance request' }] }] });
const call = () => generateGemini({ apiKey: 'synthetic-key', body });
const response = (status: number, headers?: HeadersInit) => new Response('{"candidates":[]}', { status, headers });
const models = () => mockFetch.mock.calls.map(([url]) => String(url).split('/models/')[1]?.split(':')[0]);

beforeEach(() => {
  jest.useFakeTimers();
  mockFetch.mockReset();
  globalThis.fetch = mockFetch;
  jest.spyOn(console, 'info').mockImplementation(() => undefined);
});
afterEach(() => { globalThis.fetch = originalFetch; jest.useRealTimers(); jest.restoreAllMocks(); });

async function finish(result: ReturnType<typeof call>) {
  await jest.runAllTimersAsync();
  return result;
}

test('a successful primary request returns its body without retries', async () => {
  mockFetch.mockResolvedValue(response(200));
  const result = await finish(call());
  expect(result.response.status).toBe(200);
  expect(await result.response.json()).toEqual({ candidates: [] });
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

test('503 switches to a distinct model with exactly the same multimodal request', async () => {
  mockFetch.mockResolvedValueOnce(response(503)).mockResolvedValueOnce(response(200));
  const result = await finish(call());
  expect(result.response.status).toBe(200);
  expect(models()).toEqual(['gemini-3.1-flash-lite', 'gemini-2.5-flash-lite']);
  expect(mockFetch.mock.calls.map(([, init]) => init?.body)).toEqual([body, body]);
  expect(mockFetch.mock.calls.every(([, init]) => init?.method === 'POST' && init.signal instanceof AbortSignal)).toBe(true);
});

test('persistent overload stops after three attempts', async () => {
  mockFetch.mockImplementation(async () => response(503));
  const result = await finish(call());
  expect(result.response.status).toBe(503);
  expect(models()).toEqual(['gemini-3.1-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.5-flash']);
});

test.each([400, 401, 402, 403])('%i never retries invalid requests, credentials or billing', async (status) => {
  mockFetch.mockResolvedValue(response(status));
  expect((await finish(call())).response.status).toBe(status);
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

test('a missing model immediately falls back', async () => {
  mockFetch.mockResolvedValueOnce(response(404)).mockResolvedValueOnce(response(200));
  expect((await finish(call())).response.status).toBe(200);
  expect(mockFetch).toHaveBeenCalledTimes(2);
});

test('short Retry-After is honored, long quota waits do not trigger extra requests', async () => {
  mockFetch.mockResolvedValueOnce(response(429, { 'Retry-After': '1' })).mockResolvedValueOnce(response(200));
  const result = call();
  await jest.advanceTimersByTimeAsync(999);
  expect(mockFetch).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1);
  expect((await result).response.status).toBe(200);
  mockFetch.mockReset().mockResolvedValue(response(429, { 'Retry-After': '60' }));
  expect((await finish(call())).response.status).toBe(429);
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

test('network failures also fall back', async () => {
  mockFetch.mockRejectedValueOnce(new TypeError('network unavailable')).mockResolvedValueOnce(response(200));
  expect((await finish(call())).response.status).toBe(200);
  expect(mockFetch).toHaveBeenCalledTimes(2);
});

test('stalled requests abort and the complete retry budget is bounded', async () => {
  mockFetch.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  }));
  const result = call();
  await jest.advanceTimersByTimeAsync(57_000);
  expect((await result).response.status).toBe(504);
  expect(mockFetch).toHaveBeenCalledTimes(3);
});

test('a continuation pins the model instead of replaying signed history to a fallback', async () => {
  mockFetch.mockResolvedValue(response(503));
  const result = await finish(generateGemini({ apiKey: 'synthetic-key', body, model: 'gemini-3.1-flash-lite', allowFallback: false }));
  expect(result.attempts).toBe(1);
  expect(models()).toEqual(['gemini-3.1-flash-lite']);
});

test('the caller limits provider attempts across multiple agent steps', async () => {
  mockFetch.mockResolvedValue(response(503));
  const result = await finish(generateGemini({ apiKey: 'synthetic-key', body, maxAttempts: 2 }));
  expect(result.attempts).toBe(2);
  expect(mockFetch).toHaveBeenCalledTimes(2);
});

test('cancelling a stalled provider request aborts without fallback', async () => {
  const controller = new AbortController();
  mockFetch.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  }));
  const result = generateGemini({ apiKey: 'synthetic-key', body, signal: controller.signal });
  const assertion = expect(result).rejects.toThrow();
  controller.abort(new Error('Stopped'));
  await assertion;
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

test('cancelling a retry wait starts no fallback request', async () => {
  mockFetch.mockResolvedValue(response(503));
  const controller = new AbortController();
  const result = generateGemini({ apiKey: 'synthetic-key', body, signal: controller.signal });
  const assertion = expect(result).rejects.toThrow();
  await jest.advanceTimersByTimeAsync(1);
  controller.abort(new Error('Stopped'));
  await assertion;
  await jest.runAllTimersAsync();
  expect(mockFetch).toHaveBeenCalledTimes(1);
});
