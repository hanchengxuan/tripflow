import AsyncStorage from '@react-native-async-storage/async-storage';

import { fetchExchangeRate, formatExchangeRate } from '@/features/currency/exchange-rate';

describe('exchange rate service', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('fetches and validates a Frankfurter currency pair', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ date: '2026-08-14', base: 'AUD', quote: 'CNY', rate: 4.7548 }),
    }) as jest.MockedFunction<typeof fetch>;

    await expect(fetchExchangeRate('aud', 'cny')).resolves.toMatchObject({
      baseCurrency: 'AUD',
      quoteCurrency: 'CNY',
      rate: 4.7548,
      date: '2026-08-14',
      source: 'frankfurter',
      cached: false,
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.frankfurter.dev/v2/rate/AUD/CNY',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
  });

  it('falls back to a cached rate when the provider is temporarily unavailable', async () => {
    await AsyncStorage.setItem('@tripflow/exchange-rate/v1/USD/CNY', JSON.stringify({ rate: 7.12, date: '2026-08-14', cachedAt: 1 }));
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('offline')) as jest.MockedFunction<typeof fetch>;

    await expect(fetchExchangeRate('USD', 'CNY')).resolves.toMatchObject({ rate: 7.12, cached: true });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('uses one for same-currency expenses and keeps rate input precise', async () => {
    await expect(fetchExchangeRate('CNY', 'CNY')).resolves.toMatchObject({ rate: 1, source: 'same-currency-default' });
    expect(formatExchangeRate(4.7548)).toBe('4.7548');
    expect(formatExchangeRate(0.92)).toBe('0.92');
  });
});
