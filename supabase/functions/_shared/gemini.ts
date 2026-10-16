const primaryModel = 'gemini-3.1-flash-lite';
const fallbackModels = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];
const attemptTimeoutMs = 18_000;

function retryDelay(response: Response, attempt: number) {
  const header = response.headers.get('Retry-After');
  if (header !== null) {
    const seconds = Number(header);
    const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - Date.now();
    if (Number.isFinite(delay)) return Math.max(0, delay);
  }
  return 750 * 2 ** attempt + Math.floor(Math.random() * 250);
}

export async function generateGemini({ apiKey, body, model = primaryModel }: {
  apiKey: string;
  body: string;
  model?: string;
}) {
  const models = [...new Set([model, ...fallbackModels])];
  let lastResponse = new Response(null, { status: 504 });
  let selectedModel = model;
  for (const [attempt, candidate] of models.entries()) {
    selectedModel = candidate;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), attemptTimeoutMs);
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent`, {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, body,
      });
      // Read under the same deadline so a stalled response body also fails over.
      lastResponse = new Response(await response.text(), { status: response.status, headers: response.headers });
    } catch {
      lastResponse = new Response(null, { status: 504 });
    } finally {
      clearTimeout(timeout);
    }
    console.info(JSON.stringify({ event: 'gemini_attempt', model: candidate, attempt: attempt + 1, status: lastResponse.status }));
    if (lastResponse.ok || ![404, 408, 429, 500, 502, 503, 504].includes(lastResponse.status)) break;
    if (attempt === models.length - 1) break;
    const delay = lastResponse.status === 404 ? 0 : retryDelay(lastResponse, attempt);
    // Long quota waits belong in a new user request, not a hidden retry loop.
    if (delay > 2_000) break;
    if (delay) await new Promise<void>((resolve) => setTimeout(resolve, delay));
  }
  return { response: lastResponse, model: selectedModel };
}
