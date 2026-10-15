import {
  currencyForCountryCode,
  destinationLabel,
  destinationQueryVariants,
  projectDestination,
  rankDestinationSuggestions,
  type DestinationSuggestion,
} from '@/features/destinations/destination-search';
import worldMap from '@svg-maps/world';

/** Bounding box of a country's outline; the artwork only uses relative `m` moves and `z`. */
function outlineBounds(id: string) {
  const { path } = (worldMap.locations as { id: string; path: string }[]).find((location) => location.id === id)!;
  let x = 0, y = 0, startX = 0, startY = 0, subpathStart = true;
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  const numbers: number[] = [];
  for (const token of path.match(/[mz]|-?[\d.]+(?:e-?\d+)?/gi) ?? []) {
    if (/z/i.test(token)) { x = startX; y = startY; continue; }
    if (/m/i.test(token)) { subpathStart = true; continue; }
    numbers.push(Number(token));
    if (numbers.length < 2) continue;
    const [dx, dy] = numbers.splice(0, 2);
    x += dx; y += dy;
    if (subpathStart) { startX = x; startY = y; subpathStart = false; }
    bounds[0] = Math.min(bounds[0], x); bounds[1] = Math.min(bounds[1], y);
    bounds[2] = Math.max(bounds[2], x); bounds[3] = Math.max(bounds[3], y);
  }
  return bounds;
}

describe('destination metadata', () => {
  it('maps common travel countries to local currencies', () => {
    expect(currencyForCountryCode('hk')).toBe('HKD');
    expect(currencyForCountryCode('JP')).toBe('JPY');
    expect(currencyForCountryCode('unknown')).toBeUndefined();
  });

  it('keeps city and country readable as one destination label', () => {
    expect(destinationLabel({ cityName: '东京', countryName: '日本' })).toBe('东京 · 日本');
  });

  it.each([
    ['hk', 'Hong Kong', 22.28, 114.17],
    ['jp', 'Tokyo', 35.69, 139.69],
    ['jp', 'Sapporo', 43.06, 141.35],
    ['is', 'Reykjavik', 64.15, -21.94],
    ['au', 'Sydney', -33.87, 151.21],
    ['ar', 'Buenos Aires', -34.6, -58.38],
  ])('places %s pin (%s) inside that country on the world map', (countryId, _city, latitude, longitude) => {
    const [minX, minY, maxX, maxY] = outlineBounds(countryId);
    const { x, y } = projectDestination(latitude, longitude);
    expect(x).toBeGreaterThanOrEqual(minX - 0.5);
    expect(x).toBeLessThanOrEqual(maxX + 0.5);
    expect(y).toBeGreaterThanOrEqual(minY - 0.5);
    expect(y).toBeLessThanOrEqual(maxY + 0.5);
  });

  it('adds an English geocoder query for a Chinese city alias', () => {
    expect(destinationQueryVariants('东京')).toEqual(['东京', 'Tokyo']);
  });

  it('uses trip context to disambiguate the intended country', () => {
    const suggestions: DestinationSuggestion[] = [
      {
        id: 'us-tokyo',
        cityName: 'Tokyo',
        countryName: 'United States',
        countryCode: 'US',
        timeZone: 'America/Los_Angeles',
        latitude: 35.8,
        longitude: -96.4,
      },
      {
        id: 'jp-tokyo',
        cityName: 'Tokyo',
        countryName: 'Japan',
        countryCode: 'JP',
        timeZone: 'Asia/Tokyo',
        latitude: 35.7,
        longitude: 139.7,
      },
    ];

    expect(rankDestinationSuggestions('东京', suggestions, { tripName: '日本之旅' })[0].countryCode).toBe('JP');
  });
});
