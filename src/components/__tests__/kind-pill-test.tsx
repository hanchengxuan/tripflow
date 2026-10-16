import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { View } from 'react-native';

import { KindPill } from '@/components/kind-pill';
import { ThemedText } from '@/components/themed-text';

jest.mock('@/global.css', () => ({}));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));

let tree: ReactTestRenderer;
afterEach(() => act(() => tree.unmount()));

it('shows only the icon but keeps the kind for screen readers', () => {
  act(() => { tree = create(<KindPill color="#000" softColor="#eee" label="交通" symbol={{ web: 'commute' }} iconOnly />); });
  expect(tree.root.findAllByType(ThemedText)).toHaveLength(0);
  expect(tree.root.findAllByType(View).find(({ props }) => props.accessible)?.props.accessibilityLabel).toBe('交通');
});

it('keeps the label next to the icon by default', () => {
  act(() => { tree = create(<KindPill color="#000" softColor="#eee" label="交通" symbol={{ web: 'commute' }} solid />); });
  expect(tree.root.findByType(ThemedText).props.children).toBe('交通');
});
