import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

export type AppLocale = 'zh-CN' | 'en';

const storageKey = 'tripflow.locale';

function deviceLocale(): AppLocale {
  return getLocales()[0]?.languageCode === 'zh' ? 'zh-CN' : 'en';
}

interface I18nValue {
  locale: AppLocale;
  languageTag: string;
  setLocale: (locale: AppLocale) => void;
  tx: (zh: string, en: string) => string;
  formatDate: (value: string | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatDateTime: (value: string | Date) => string;
}

const I18nContext = createContext<I18nValue | undefined>(undefined);

export function LanguageProvider({ children }: PropsWithChildren) {
  const [locale, setLocaleState] = useState<AppLocale>(deviceLocale);

  useEffect(() => {
    void AsyncStorage.getItem(storageKey).then((saved) => {
      if (saved === 'zh-CN' || saved === 'en') setLocaleState(saved);
    });
  }, []);

  const value = useMemo<I18nValue>(() => ({
    locale,
    languageTag: locale === 'zh-CN' ? 'zh-CN' : 'en-US',
    setLocale: (next) => {
      setLocaleState(next);
      void AsyncStorage.setItem(storageKey, next);
    },
    tx: (zh, en) => locale === 'zh-CN' ? zh : en,
    formatDate: (input, options) => new Date(input).toLocaleDateString(
      locale === 'zh-CN' ? 'zh-CN' : 'en-US',
      options ?? { year: 'numeric', month: 'short', day: 'numeric' },
    ),
    formatDateTime: (input) => new Date(input).toLocaleString(locale === 'zh-CN' ? 'zh-CN' : 'en-US'),
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used within LanguageProvider.');
  return value;
}
