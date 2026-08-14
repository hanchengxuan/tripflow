import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://api.frankfurter.dev/v2';
const CACHE_KEY_PREFIX = '@tripflow/exchange-rate/v1';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

type CachedExchangeRate = {
  rate: number;
  date: string;
  cachedAt: number;
};

export type ExchangeRateSource = 'frankfurter' | 'same-currency-default';

export type ExchangeRateResult = {
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  date: string;
  source: ExchangeRateSource;
  cached: boolean;
};

const memoryCache = new Map<string, CachedExchangeRate>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeCurrencyCode(value: string) {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) throw new Error('Invalid currency code');
  return normalized;
}

function isValidDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidCachedRate(value: unknown): value is CachedExchangeRate {
  if (!isRecord(value)) return false;
  return typeof value.rate === 'number'
    && Number.isFinite(value.rate)
    && value.rate > 0
    && isValidDate(value.date)
    && typeof value.cachedAt === 'number'
    && Number.isFinite(value.cachedAt);
}

function cacheKey(baseCurrency: string, quoteCurrency: string) {
  return `${CACHE_KEY_PREFIX}/${baseCurrency}/${quoteCurrency}`;
}

function toResult(baseCurrency: string, quoteCurrency: string, record: CachedExchangeRate, cached: boolean): ExchangeRateResult {
  return {
    baseCurrency,
    quoteCurrency,
    rate: record.rate,
    date: record.date,
    source: 'frankfurter',
    cached,
  };
}

async function readCachedRate(key: string) {
  const inMemory = memoryCache.get(key);
  if (inMemory) return inMemory;

  try {
    const serialized = await AsyncStorage.getItem(key);
    if (!serialized) return undefined;
    const parsed: unknown = JSON.parse(serialized);
    if (!isValidCachedRate(parsed)) return undefined;
    memoryCache.set(key, parsed);
    return parsed;
  } catch {
    return undefined;
  }
}

function parseApiResponse(payload: unknown, baseCurrency: string, quoteCurrency: string): CachedExchangeRate {
  if (!isRecord(payload)
    || payload.base !== baseCurrency
    || payload.quote !== quoteCurrency
    || !isValidDate(payload.date)
    || typeof payload.rate !== 'number'
    || !Number.isFinite(payload.rate)
    || payload.rate <= 0) {
    throw new Error('Invalid exchange-rate response');
  }

  return {
    rate: payload.rate,
    date: payload.date,
    cachedAt: Date.now(),
  };
}

export function formatExchangeRate(rate: number) {
  return rate.toFixed(12).replace(/0+$/, '').replace(/\.$/, '');
}

export async function fetchExchangeRate(sourceCurrency: string, targetCurrency: string, signal?: AbortSignal): Promise<ExchangeRateResult> {
  const baseCurrency = normalizeCurrencyCode(sourceCurrency);
  const quoteCurrency = normalizeCurrencyCode(targetCurrency);

  if (baseCurrency === quoteCurrency) {
    return {
      baseCurrency,
      quoteCurrency,
      rate: 1,
      date: new Date().toISOString().slice(0, 10),
      source: 'same-currency-default',
      cached: false,
    };
  }

  const key = cacheKey(baseCurrency, quoteCurrency);
  const cached = await readCachedRate(key);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return toResult(baseCurrency, quoteCurrency, cached, true);
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/rate/${encodeURIComponent(baseCurrency)}/${encodeURIComponent(quoteCurrency)}`,
      { headers: { Accept: 'application/json' }, signal },
    );
    if (!response.ok) throw new Error(`Exchange-rate request failed (${response.status})`);
    const payload: unknown = await response.json();
    const record = parseApiResponse(payload, baseCurrency, quoteCurrency);
    memoryCache.set(key, record);
    void AsyncStorage.setItem(key, JSON.stringify(record)).catch(() => undefined);
    return toResult(baseCurrency, quoteCurrency, record, false);
  } catch (caught) {
    if (signal?.aborted) throw caught;
    if (cached) return toResult(baseCurrency, quoteCurrency, cached, true);
    throw new Error('Unable to fetch the exchange rate');
  }
}
