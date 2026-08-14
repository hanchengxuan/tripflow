import type { ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';

jest.mock('@/components/themed-text', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text: NativeText } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    ThemedText: ({ children, ...props }: { children: ReactNode }) => React.createElement(NativeText, props, children),
  };
});

jest.mock('@/features/i18n/i18n-provider', () => ({
  useI18n: () => ({ tx: (zh: string) => zh }),
}));

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    backgroundElement: '#ffffff',
    borderField: '#cccccc',
    scrim: 'rgba(0,0,0,0.7)',
    shadow: '#000000',
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

describe('BottomSheet', () => {
  it('does not mount its contents while hidden', () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <BottomSheet onDismiss={jest.fn()} title="测试" visible={false}>
          <Text>内容</Text>
        </BottomSheet>,
      );
    });

    expect(tree.toJSON()).toBeNull();
  });

  it('exposes both dismissal paths and renders its contents', () => {
    const onDismiss = jest.fn();
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <BottomSheet onDismiss={onDismiss} title="测试" visible>
          <Text>内容</Text>
        </BottomSheet>,
      );
    });

    expect(tree.root.findByProps({ children: '内容' })).toBeTruthy();
    act(() => tree.root.findByProps({ accessible: false }).props.onPress());
    act(() => tree.root.findByProps({ accessibilityLabel: '取消并关闭' }).props.onPress());
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });
});
