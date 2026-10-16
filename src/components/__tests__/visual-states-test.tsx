import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { RouteEstimateChip } from '@/components/route-plan';
import { Screen } from '@/components/screen';

jest.mock('@/global.css', () => ({}));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/features/i18n/i18n-provider', () => ({ useI18n: () => ({ locale: 'en', tx: (_zh: string, en: string) => en }) }));

let tree: ReactTestRenderer;
afterEach(() => act(() => tree.unmount()));
const byLabel = (label: string) => tree.root.findAll(({ props }) => props.accessibilityLabel === label);

it('shows a loading skeleton instead of the content on a first load', () => {
  act(() => { tree = create(<Screen context={[]} title="Today" loading><Text>Trip content</Text></Screen>); });
  expect(byLabel('Loading').length).toBeGreaterThan(0);
  expect(tree.root.findAll(({ props }) => props.children === 'Trip content')).toHaveLength(0);

  act(() => tree.update(<Screen context={[]} title="Today"><Text>Trip content</Text></Screen>));
  expect(byLabel('Loading')).toHaveLength(0);
  expect(tree.root.findAll(({ props }) => props.children === 'Trip content').length).toBeGreaterThan(0);
});

it('offers the one step that fills an empty space', () => {
  const onAction = jest.fn();
  act(() => { tree = create(<EmptyState symbol={{ web: 'map' }} title="No trip yet" actionLabel="Go to Trips" onAction={onAction} />); });
  act(() => byLabel('Go to Trips')[0].props.onPress());
  expect(onAction).toHaveBeenCalled();
});

it('names the travel mode for screen readers even though the chip shows an icon', () => {
  act(() => { tree = create(<RouteEstimateChip mode="TRANSIT" modeLabel="Transit" detail="35 min" />); });
  expect(byLabel('Transit').length).toBeGreaterThan(0);
  expect(tree.root.findAll(({ props }) => props.children === 'Transit')).toHaveLength(0);
});
