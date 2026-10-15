import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { MvpProvider, useMvp } from '@/features/mvp/mvp-provider';

const mockTrips = [
  { id: 'trip-a', createdBy: 'user-1', name: 'Alpha', startsOn: '2026-10-20', endsOn: '2026-10-25', homeCurrency: 'JPY', defaultTimeZone: 'Asia/Tokyo' },
  { id: 'trip-b', createdBy: 'user-1', name: 'Bravo', startsOn: '2026-11-14', endsOn: '2026-11-21', homeCurrency: 'JPY', defaultTimeZone: 'Asia/Tokyo' },
];
let mockUserId = 'user-1';

jest.mock('@/features/auth/auth-provider', () => ({
  useAuth: () => ({ session: { user: { id: mockUserId } } }),
}));

jest.mock('@/data/trip-repository', () => {
  const empty = () => Promise.resolve([]);
  return {
    listTrips: () => Promise.resolve(mockTrips),
    getProfile: () => Promise.resolve(undefined),
    listTripMembers: empty,
    listLedgerMembers: empty,
    listItineraryItems: empty,
    listSegments: empty,
    listSegmentMembers: empty,
    listExpenses: empty,
    listSettlements: empty,
  };
});

const controls: { selectTrip?: (tripId: string) => Promise<void> } = {};
const selectTrip = (tripId: string) => controls.selectTrip!(tripId);

function ActiveTripName() {
  const mvp = useMvp();
  useEffect(() => {
    controls.selectTrip = mvp.selectTrip;
  });
  return <Text>{mvp.loading ? 'loading' : mvp.activeTrip?.name ?? 'none'}</Text>;
}

let mounted: ReactTestRenderer[] = [];

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function mount() {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<MvpProvider><ActiveTripName /></MvpProvider>);
  });
  mounted.push(renderer);
  await settle();
  return renderer;
}

async function unmount(renderer: ReactTestRenderer) {
  await settle();
  await act(async () => renderer.unmount());
  mounted = mounted.filter((entry) => entry !== renderer);
}

const shownTrip = (renderer: ReactTestRenderer) => renderer.root.findByType(Text).props.children;

afterEach(async () => {
  for (const renderer of mounted) await unmount(renderer);
});

beforeEach(async () => {
  mockUserId = 'user-1';
  await AsyncStorage.clear();
});

test('a reload reopens the trip the traveller last selected', async () => {
  const first = await mount();
  expect(shownTrip(first)).toBe('Alpha');

  await act(async () => {
    await selectTrip('trip-b');
  });
  expect(shownTrip(first)).toBe('Bravo');
  await unmount(first);

  const reloaded = await mount();
  expect(shownTrip(reloaded)).toBe('Bravo');
});

test('another account on the same device does not inherit the selection', async () => {
  const first = await mount();
  await act(async () => {
    await selectTrip('trip-b');
  });
  await unmount(first);

  mockUserId = 'user-2';
  const other = await mount();
  expect(shownTrip(other)).toBe('Alpha');
});

test('a remembered trip the traveller can no longer see falls back to the first trip', async () => {
  await AsyncStorage.setItem('tripflow.activeTrip.user-1', 'trip-removed');
  const renderer = await mount();
  expect(shownTrip(renderer)).toBe('Alpha');
});
