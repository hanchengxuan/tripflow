import { defaultHomeCurrency, defaultTripTimeZone, deviceTimeZone } from '@/features/trips/trip-defaults';

describe('new trip defaults', () => {
  it('reuses the most recent trip rather than a hardcoded city', () => {
    const trips = [
      { homeCurrency: 'JPY', defaultTimeZone: 'Asia/Tokyo' },
      { homeCurrency: 'HKD', defaultTimeZone: 'Asia/Hong_Kong' },
    ];

    expect(defaultHomeCurrency(trips)).toBe('JPY');
    expect(defaultTripTimeZone(trips)).toBe('Asia/Tokyo');
  });

  it('normalises a stored currency', () => {
    expect(defaultHomeCurrency([{ homeCurrency: ' cny ' }])).toBe('CNY');
  });

  it('skips blank values instead of returning them', () => {
    expect(defaultHomeCurrency([{ homeCurrency: '  ' }, { homeCurrency: 'EUR' }])).toBe('EUR');
    expect(defaultTripTimeZone([{ defaultTimeZone: '' }, { defaultTimeZone: 'Europe/Paris' }])).toBe('Europe/Paris');
  });

  it('falls back to the device zone for a first trip', () => {
    expect(defaultTripTimeZone([])).toBe(deviceTimeZone());
    expect(deviceTimeZone()).toMatch(/^[A-Za-z]+(\/[A-Za-z_+\-0-9]+)*$/);
  });

  it('falls back to an explicit currency for a first trip', () => {
    expect(defaultHomeCurrency([])).toBe('USD');
    expect(defaultHomeCurrency([], 'CNY')).toBe('CNY');
  });
});
