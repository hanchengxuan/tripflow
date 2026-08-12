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

function seconds(duration?: string) {
  return duration ? Math.round(Number.parseFloat(duration)) : 0;
}

interface RouteStep {
  distanceMeters?: number;
  staticDuration?: string;
  travelMode?: string;
  transitDetails?: {
    stopDetails?: {
      arrivalStop?: { name?: string };
      departureStop?: { name?: string };
      arrivalTime?: string;
      departureTime?: string;
    };
    localizedValues?: {
      arrivalTime?: { time?: { text?: string } };
      departureTime?: { time?: { text?: string } };
    };
    headsign?: string;
    stopCount?: number;
    transitLine?: {
      name?: string;
      nameShort?: string;
      vehicle?: { name?: { text?: string }; type?: string };
    };
  };
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Sign in required' }, 401);

  const publishableKey = getPublishableKey();
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!publishableKey || !supabaseUrl) return json({ error: 'Authentication is unavailable' }, 503);
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: authorization, apikey: publishableKey },
  });
  if (!userResponse.ok) return json({ error: 'Sign in required' }, 401);

  const apiKey = Deno.env.get('GOOGLE_ROUTES_API_KEY');
  if (!apiKey) return json({ error: 'Route estimates are not configured' }, 503);

  try {
    const body = await request.json() as { tripId?: string; originPlaceId?: string; destinationPlaceId?: string; travelMode?: string; departureTime?: string };
    const tripId = body.tripId?.trim() ?? '';
    const originPlaceId = body.originPlaceId?.trim() ?? '';
    const destinationPlaceId = body.destinationPlaceId?.trim() ?? '';
    const travelMode = body.travelMode?.trim().toUpperCase() ?? 'DRIVE';
    const requestedDeparture = body.departureTime ? new Date(body.departureTime) : undefined;
    if (!/^[0-9a-f-]{36}$/i.test(tripId) || !originPlaceId || !destinationPlaceId || originPlaceId.length > 300 || destinationPlaceId.length > 300) {
      return json({ error: 'Two valid places are required' }, 400);
    }
    if (!['DRIVE', 'TRANSIT', 'WALK', 'BICYCLE'].includes(travelMode)) return json({ error: 'Travel mode is invalid' }, 400);
    if (requestedDeparture && Number.isNaN(requestedDeparture.getTime())) return json({ error: 'Departure time is invalid' }, 400);

    const membershipResponse = await fetch(
      `${supabaseUrl}/rest/v1/trip_members?select=trip_id&trip_id=eq.${encodeURIComponent(tripId)}&limit=1`,
      { headers: { Authorization: authorization, apikey: publishableKey } },
    );
    if (!membershipResponse.ok) return json({ error: 'Unable to verify trip membership' }, 503);
    const memberships = await membershipResponse.json() as { trip_id: string }[];
    if (memberships.length === 0) return json({ error: 'Trip membership required' }, 403);

    const now = Date.now();
    const canPlanAtRequestedTime = requestedDeparture
      && requestedDeparture.getTime() > now
      && requestedDeparture.getTime() < now + 100 * 24 * 60 * 60 * 1000;
    const fieldMask = travelMode === 'TRANSIT'
      ? 'routes.distanceMeters,routes.duration,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.legs.steps.travelMode,routes.legs.steps.transitDetails'
      : 'routes.distanceMeters,routes.duration';
    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify({
        origin: { placeId: originPlaceId },
        destination: { placeId: destinationPlaceId },
        travelMode,
        ...(travelMode === 'DRIVE' ? { routingPreference: 'TRAFFIC_UNAWARE' } : {}),
        ...(travelMode === 'TRANSIT' && canPlanAtRequestedTime ? { departureTime: requestedDeparture.toISOString() } : {}),
        computeAlternativeRoutes: false,
      }),
    });
    if (!response.ok) {
      console.error('Routes request failed', response.status, (await response.text()).slice(0, 500));
      return json({ error: 'Route estimate is temporarily unavailable', providerStatus: response.status }, 502);
    }
    const data = await response.json() as { routes?: { distanceMeters?: number; duration?: string; legs?: { steps?: RouteStep[] }[] }[] };
    const route = data.routes?.[0];
    if (!route?.distanceMeters || !route.duration) return json({ route: null });
    const steps = route.legs?.flatMap((leg) => leg.steps ?? []) ?? [];
    const transitSteps = steps.flatMap((step) => {
      const details = step.transitDetails;
      const stops = details?.stopDetails;
      const line = details?.transitLine;
      if (step.travelMode !== 'TRANSIT' || !details || !stops) return [];
      return [{
        departureTime: stops.departureTime,
        arrivalTime: stops.arrivalTime,
        departureTimeText: details.localizedValues?.departureTime?.time?.text,
        arrivalTimeText: details.localizedValues?.arrivalTime?.time?.text,
        departureStop: stops.departureStop?.name ?? '',
        arrivalStop: stops.arrivalStop?.name ?? '',
        lineName: line?.nameShort ?? line?.name ?? line?.vehicle?.name?.text ?? '',
        vehicleName: line?.vehicle?.name?.text ?? '',
        vehicleType: line?.vehicle?.type ?? '',
        headsign: details.headsign ?? '',
        stopCount: details.stopCount ?? 0,
        durationSeconds: seconds(step.staticDuration),
      }];
    });
    const walking = steps.filter((step) => step.travelMode === 'WALK').reduce<{ distanceMeters: number; durationSeconds: number }>(
      (total, step) => ({
        distanceMeters: total.distanceMeters + (step.distanceMeters ?? 0),
        durationSeconds: total.durationSeconds + seconds(step.staticDuration),
      }),
      { distanceMeters: 0, durationSeconds: 0 },
    );
    return json({ route: {
      distanceMeters: route.distanceMeters,
      durationSeconds: seconds(route.duration),
      ...(travelMode === 'TRANSIT' ? { transit: { steps: transitSteps, walking } } : {}),
    } });
  } catch (error) {
    console.error('Route estimate failed', error instanceof Error ? error.message : 'unknown error');
    return json({ error: 'Route estimate failed' }, 500);
  }
});
