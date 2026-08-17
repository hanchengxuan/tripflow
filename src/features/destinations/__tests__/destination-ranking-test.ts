import {
  destinationLabel,
  destinationQueryVariants,
  searchDestinations,
} from '@/features/destinations/destination-search';

import fixtures from './fixtures/open-meteo-geocoder.json';

/**
 * Recorded Open-Meteo responses, captured verbatim on 2026-08-17. They keep the
 * awkward shapes the live service actually returns — a null `country` for Hong
 * Kong, a five-person "Hong Kong" in Mexico, a Chinese town called 东京, and no
 * results at all for `hk` — so the ranking is exercised against reality rather
 * than a tidy invention.
 */
const recorded = fixtures as Record<string, Record<string, unknown[]>>;

// The live service matches names case-insensitively; the stub must too, or a
// lowercase query would look like a network miss rather than a ranking result.
const recordedByLowerName = new Map(
  Object.entries(recorded).map(([name, byLanguage]) => [name.toLowerCase(), byLanguage]),
);

function stubGeocoder() {
  return jest.fn(async (url: string) => {
    const parsed = new URL(url);
    const name = parsed.searchParams.get('name') ?? '';
    const language = parsed.searchParams.get('language') ?? 'en';
    const results = recordedByLowerName.get(name.toLowerCase())?.[language];
    if (!results) return { ok: true, json: async () => ({}) };
    return { ok: true, json: async () => ({ results }) };
  });
}

let fetchStub: ReturnType<typeof stubGeocoder>;

beforeEach(() => {
  fetchStub = stubGeocoder();
  (globalThis as { fetch?: unknown }).fetch = fetchStub;
});

describe('destination search against recorded geocoder responses', () => {
  it('offers Hong Kong itself, not the village in Mexico', async () => {
    const results = await searchDestinations('hong kong', 'zh-CN', { tripName: 'HK' });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].countryCode).toBe('HK');
    expect(results[0].timeZone).toBe('Asia/Hong_Kong');
    expect(results[0].currency).toBe('HKD');
    expect(results.findIndex(({ countryCode }) => countryCode === 'MX')).not.toBe(0);
  });

  it('resolves the Chinese name even though the geocoder has no English entry for it', async () => {
    const results = await searchDestinations('香港', 'zh-CN', {});

    expect(results[0].countryCode).toBe('HK');
    expect(destinationLabel(results[0])).toBe('香港');
  });

  it('resolves a short code the geocoder returns nothing for', async () => {
    expect(destinationQueryVariants('hk')).toEqual(['hk', 'Hong Kong']);

    const results = await searchDestinations('hk', 'zh-CN', {});
    expect(results[0].countryCode).toBe('HK');
  });

  it('prefers Tokyo over the Chinese town that shares the Simplified name', async () => {
    const results = await searchDestinations('东京', 'zh-CN', {});

    expect(results[0].countryCode).toBe('JP');
    expect(results[0].timeZone).toBe('Asia/Tokyo');
  });

  it('collapses the same place returned in two languages into one row', async () => {
    const results = await searchDestinations('Tokyo', 'zh-CN', {});
    const japanese = results.filter(({ countryCode }) => countryCode === 'JP');

    expect(new Set(japanese.map(({ id }) => id)).size).toBe(japanese.length);
    expect(japanese.filter(({ timeZone }) => timeZone === 'Asia/Tokyo')).toHaveLength(1);
  });

  it('shows one Hong Kong, not the capital record and the territory record', async () => {
    const results = await searchDestinations('香港', 'zh-CN', {});
    const identical = results.filter((suggestion) => (
      destinationLabel(suggestion) === '香港' && suggestion.timeZone === 'Asia/Hong_Kong'
    ));

    expect(identical).toHaveLength(1);
  });

  it('does not let a record dropped in one language return in the other', async () => {
    const results = await searchDestinations('hong kong', 'zh-CN', {});
    const hongKong = results.filter(({ countryCode }) => countryCode === 'HK');

    // The city is filed twice (capital and territory) and fetched in two
    // languages, so it arrives four times. Exactly one row may survive —
    // whichever name matches what was typed.
    const city = hongKong.filter(({ cityName }) => cityName === '香港' || cityName === 'Hong Kong');
    expect(city).toHaveLength(1);
    expect(new Set(hongKong.map(({ id }) => id)).size).toBe(hongKong.length);
  });

  it('drops airports, parks, and mountains from a destination picker', async () => {
    const results = await searchDestinations('Tokyo', 'en', {});

    expect(results.some(({ cityName }) => cityName.includes('Zan'))).toBe(false);
  });
});

describe('country hints in free text', () => {
  it('does not treat a two-letter code inside an ordinary word as a country', async () => {
    // "museum" contains "us"; before this guard every US result was boosted.
    const results = await searchDestinations('hong kong', 'zh-CN', { planTitle: 'Museum morning' });

    expect(results[0].countryCode).toBe('HK');
  });
});
