import { routeEstimateState, type RouteEstimate } from '@/features/routes/route-estimate';

jest.mock('@/lib/supabase', () => ({ getSupabaseClient: jest.fn() }));

const estimate: RouteEstimate = { distanceMeters: 15000, durationSeconds: 2400 };
const airport = { googlePlaceId: 'place-hnd' };
const hotel = { id: 'transfer', googlePlaceId: 'place-hotel' };

it('asks for places when either end is only a typed address', () => {
  expect(routeEstimateState({}, hotel, { transfer: estimate })).toEqual({ status: 'needs-places' });
  expect(routeEstimateState(airport, { id: 'transfer' }, { transfer: estimate })).toEqual({ status: 'needs-places' });
});

it('is loading until the lookup for that leg finishes', () => {
  expect(routeEstimateState(airport, hotel, {})).toEqual({ status: 'loading' });
});

it('separates a missing route and a failed lookup from a finished estimate', () => {
  expect(routeEstimateState(airport, hotel, { transfer: 'no-route' })).toEqual({ status: 'no-route' });
  expect(routeEstimateState(airport, hotel, { transfer: 'failed' })).toEqual({ status: 'failed' });
  expect(routeEstimateState(airport, hotel, { transfer: estimate })).toEqual({ status: 'ready', estimate });
});
