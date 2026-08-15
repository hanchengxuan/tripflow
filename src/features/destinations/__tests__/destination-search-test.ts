import { currencyForCountryCode, destinationLabel, projectDestination } from '@/features/destinations/destination-search';

describe('destination metadata', () => {
  it('maps common travel countries to local currencies', () => {
    expect(currencyForCountryCode('hk')).toBe('HKD');
    expect(currencyForCountryCode('JP')).toBe('JPY');
    expect(currencyForCountryCode('unknown')).toBeUndefined();
  });

  it('keeps city and country readable as one destination label', () => {
    expect(destinationLabel({ cityName: '东京', countryName: '日本' })).toBe('东京 · 日本');
  });

  it('projects coordinates inside the atlas view', () => {
    const point = projectDestination(22.3, 114.2);
    expect(point.x).toBeGreaterThan(0);
    expect(point.x).toBeLessThan(1010);
    expect(point.y).toBeGreaterThan(0);
    expect(point.y).toBeLessThan(666);
  });
});
