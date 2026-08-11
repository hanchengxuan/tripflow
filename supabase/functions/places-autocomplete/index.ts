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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!request.headers.get('Authorization')?.startsWith('Bearer ')) return json({ error: 'Sign in required' }, 401);

  // GOOGLE_PLACE_API_KEY is the canonical TripFlow secret. Keep the previous
  // name as a compatibility fallback for existing environments.
  const apiKey = Deno.env.get('GOOGLE_PLACE_API_KEY') ?? Deno.env.get('GOOGLE_MAPS_API_KEY');
  if (!apiKey) return json({ error: 'Places autocomplete is not configured' }, 503);

  try {
    const body = await request.json() as { input?: string; locale?: string; sessionToken?: string };
    const input = body.input?.trim() ?? '';
    if (input.length < 3 || input.length > 120) return json({ suggestions: [] });

    const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
      },
      body: JSON.stringify({
        input,
        languageCode: body.locale === 'zh-CN' ? 'zh-CN' : 'en',
        sessionToken: body.sessionToken,
        includeQueryPredictions: false,
      }),
    });
    if (!response.ok) {
      console.error('Places request failed', response.status, (await response.text()).slice(0, 500));
      return json({ error: 'Place search is temporarily unavailable', providerStatus: response.status }, 502);
    }

    const data = await response.json() as {
      suggestions?: Array<{ placePrediction?: {
        placeId?: string;
        text?: { text?: string };
        structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
      } }>;
    };
    const suggestions = (data.suggestions ?? []).flatMap(({ placePrediction }) => {
      if (!placePrediction?.placeId || !placePrediction.text?.text) return [];
      return [{
        placeId: placePrediction.placeId,
        text: placePrediction.text.text,
        mainText: placePrediction.structuredFormat?.mainText?.text ?? placePrediction.text.text,
        secondaryText: placePrediction.structuredFormat?.secondaryText?.text ?? '',
      }];
    }).slice(0, 5);
    return json({ suggestions });
  } catch (error) {
    console.error('Places autocomplete failed', error instanceof Error ? error.message : 'unknown error');
    return json({ error: 'Place search failed' }, 500);
  }
});
