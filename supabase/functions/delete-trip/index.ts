declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function getPublishableKey() {
  const modernKeys = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');
  if (modernKeys) {
    const keys = JSON.parse(modernKeys) as Record<string, string>;
    if (keys.default) return keys.default;
  }
  return Deno.env.get('SUPABASE_ANON_KEY');
}

async function requestJson<T>(url: string, key: string, authorization: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      apikey: key,
      Authorization: authorization,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => undefined) as { message?: string } | undefined;
    throw new Error(body?.message ?? `Supabase request failed with ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: '仅支持 POST 请求。' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: '请先登录。' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const publishableKey = getPublishableKey();
  if (!supabaseUrl || !serviceRoleKey || !publishableKey) return json({ error: '删除服务尚未完成配置。' }, 503);

  try {
    const { tripId } = await request.json() as { tripId?: string };
    if (!tripId || !/^[0-9a-f-]{36}$/i.test(tripId)) return json({ error: '行程信息无效。' }, 400);

    const authUser = await requestJson<{ id: string }>(`${supabaseUrl}/auth/v1/user`, publishableKey, authorization);
    const serviceAuthorization = `Bearer ${serviceRoleKey}`;
    const trips = await requestJson<{ created_by: string }[]>(
      `${supabaseUrl}/rest/v1/trips?id=eq.${encodeURIComponent(tripId)}&select=created_by`,
      serviceRoleKey,
      serviceAuthorization,
    );
    if (!trips[0]) return json({ error: '行程不存在或已被删除。' }, 404);
    if (trips[0].created_by !== authUser.id) return json({ error: '只有行程创建者可以永久删除此行程。' }, 403);

    const receiptRows = await requestJson<{ storage_path: string }[]>(
      `${supabaseUrl}/rest/v1/expense_receipts?select=storage_path,expenses!inner(trip_id)&expenses.trip_id=eq.${encodeURIComponent(tripId)}`,
      serviceRoleKey,
      serviceAuthorization,
    );

    await requestJson<unknown>(
      `${supabaseUrl}/rest/v1/rpc/delete_trip`,
      publishableKey,
      authorization,
      { method: 'POST', body: JSON.stringify({ requested_trip_id: tripId }) },
    );

    const receiptPaths = (receiptRows ?? []).map(({ storage_path }) => storage_path).filter(Boolean);
    let cleanupPending = false;
    if (receiptPaths.length > 0) {
      const cleanupResponse = await fetch(`${supabaseUrl}/storage/v1/object/expense-receipts`, {
        method: 'DELETE',
        headers: { apikey: serviceRoleKey, Authorization: serviceAuthorization, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefixes: receiptPaths }),
      });
      cleanupPending = !cleanupResponse.ok;
    }

    return json({ success: true, cleanupPending });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : '无法删除行程，请稍后重试。' }, 400);
  }
});
