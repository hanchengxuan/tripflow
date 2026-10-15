import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { LanguageProvider, useI18n } from '@/features/i18n/i18n-provider';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'zh' }] }));
let language: ReturnType<typeof useI18n>;
function Probe() {
  const value = useI18n();
  useEffect(() => { language = value; });
  return null;
}

it('updates document language after saved preference hydration and later switches', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const root = { lang: '' };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { documentElement: root } });
  let tree: ReactTestRenderer | undefined;
  try {
    await AsyncStorage.setItem('tripflow.locale', 'en');
    await act(async () => { tree = create(<LanguageProvider><Probe /></LanguageProvider>); });
    expect(root.lang).toBe('en-US');
    act(() => language.setLocale('zh-CN'));
    expect(root.lang).toBe('zh-CN');
    act(() => language.setLocale('en'));
    expect(root.lang).toBe('en-US');
  } finally {
    act(() => tree?.unmount());
    await AsyncStorage.clear();
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
