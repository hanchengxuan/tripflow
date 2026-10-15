import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { BottomSheet } from '@/components/bottom-sheet';
import { DestinationAtlas } from '@/components/destination-atlas';
import { ThemedText } from '@/components/themed-text';
import type { ItineraryItem } from '@/domain/models';

jest.mock('@/global.css', () => ({}));
jest.mock('react-native-reanimated', () => ({ useSharedValue: <T,>(value: T) => ({ value }) }));
jest.mock('react-native-gesture-handler', () => {
  const chain: object = new Proxy({}, { get: () => () => chain });
  return { Gesture: chain, GestureDetector: ({ children }: { children: React.ReactNode }) => children };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/features/i18n/i18n-provider', () => ({ useI18n: () => ({ locale: 'en', languageTag: 'en-US', tx: (_zh: string, en: string) => en }) }));

const tokyo = { cityName: 'Tokyo', countryName: 'Japan', countryCode: 'JP', timeZone: 'Asia/Tokyo', currency: 'JPY', latitude: 35.69, longitude: 139.69 };
const osaka = { ...tokyo, cityName: 'Osaka', latitude: 34.69, longitude: 135.5 };
const plan = (id: string, title: string, destination: typeof tokyo, startsAt: string) =>
  ({ id, tripId: 't', kind: 'activity', title, routeTravelMode: 'WALK', startsAt, destination }) as ItineraryItem;
const items = [
  plan('a', 'Senso-ji', tokyo, '2026-12-16T01:00:00Z'),
  plan('b', 'Shibuya dinner', tokyo, '2026-12-16T10:00:00Z'),
  plan('c', 'Osaka Castle', osaka, '2026-12-18T01:00:00Z'),
];

let tree: ReactTestRenderer;
const tx = (_zh: string, en: string) => en;
const marker = (index: number) => tree.root.findByProps({ testID: `destination-marker-${index}` });
const sheet = () => tree.root.findByType(BottomSheet);
const texts = () => tree.root.findAllByType(ThemedText).map(({ props }) => props.children).filter((text): text is string => typeof text === 'string');

afterEach(() => act(() => tree.unmount()));

it('lists every plan when a pin with several plans is tapped', () => {
  const onViewItem = jest.fn();
  act(() => { tree = create(<DestinationAtlas items={items} languageTag="en-US" tx={tx} onViewItem={onViewItem} />); });
  expect(sheet().props.visible).toBe(false);

  jest.useFakeTimers();
  act(() => marker(0).props.onPress());
  act(() => { jest.runOnlyPendingTimers(); });
  jest.useRealTimers();

  expect(sheet().props.visible).toBe(true);
  expect(sheet().props.title).toBe('Tokyo');
  expect(onViewItem).not.toHaveBeenCalled();
});

it('opens the plan directly when its pin has only one', () => {
  const onViewItem = jest.fn();
  act(() => { tree = create(<DestinationAtlas items={items} languageTag="en-US" tx={tx} onViewItem={onViewItem} />); });

  act(() => marker(1).props.onPress());

  expect(onViewItem).toHaveBeenCalledWith(items[2]);
  expect(sheet().props.visible).toBe(false);
});

it('names each pinned city on the map', () => {
  act(() => { tree = create(<DestinationAtlas items={items} languageTag="en-US" tx={tx} />); });
  expect(texts()).toEqual(expect.arrayContaining(['Tokyo', 'Osaka']));
});
