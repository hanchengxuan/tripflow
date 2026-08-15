export interface DestinationSuggestion {
  id: string;
  cityName: string;
  countryName: string;
  countryCode: string;
  timeZone: string;
  currency?: string;
  latitude: number;
  longitude: number;
  adminArea?: string;
}

/**
 * Open-Meteo's geocoder gives us the city, country, timezone, and coordinates
 * without a key. Currency is deliberately kept as a small local lookup: the
 * geocoder does not return it, and this avoids sending a second request for
 * every suggestion just to render a sensible default.
 */
const currencyByCountryCode: Record<string, string> = {
  AE: 'AED', AR: 'ARS', AT: 'EUR', AU: 'AUD', BE: 'EUR', BG: 'BGN', BR: 'BRL', CA: 'CAD',
  CH: 'CHF', CL: 'CLP', CN: 'CNY', CO: 'COP', CZ: 'CZK', DE: 'EUR', DK: 'DKK', EG: 'EGP',
  ES: 'EUR', FI: 'EUR', FR: 'EUR', GB: 'GBP', GR: 'EUR', HK: 'HKD', HR: 'EUR', HU: 'HUF',
  ID: 'IDR', IE: 'EUR', IL: 'ILS', IN: 'INR', IS: 'ISK', IT: 'EUR', JP: 'JPY', KE: 'KES',
  KH: 'KHR', KR: 'KRW', LA: 'LAK', LU: 'EUR', MA: 'MAD', MO: 'MOP', MX: 'MXN', MY: 'MYR',
  NL: 'EUR', NO: 'NOK', NZ: 'NZD', PE: 'PEN', PH: 'PHP', PL: 'PLN', PT: 'EUR', QA: 'QAR',
  RO: 'RON', RU: 'RUB', SA: 'SAR', SE: 'SEK', SG: 'SGD', TH: 'THB', TR: 'TRY', TW: 'TWD',
  UA: 'UAH', US: 'USD', VN: 'VND', ZA: 'ZAR',
};

export function currencyForCountryCode(countryCode: string) {
  return currencyByCountryCode[countryCode.trim().toUpperCase()];
}

export function destinationLabel(destination: Pick<DestinationSuggestion, 'cityName' | 'countryName'>) {
  return `${destination.cityName} · ${destination.countryName}`;
}

export function projectDestination(latitude: number, longitude: number) {
  const x = ((longitude + 180) / 360) * 1010;
  const y = Math.max(18, Math.min(666 - 18, ((90 - latitude) / 180) * 666 + 150));
  return { x, y };
}

export async function searchDestinations(input: string, locale: string): Promise<DestinationSuggestion[]> {
  const query = input.trim();
  if (query.length < 2) return [];

  const language = locale === 'zh-CN' ? 'zh' : 'en';
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=8&language=${language}&format=json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Destination search is temporarily unavailable');

  const payload = await response.json() as {
    results?: {
      id?: number;
      name?: string;
      country?: string;
      country_code?: string;
      timezone?: string;
      latitude?: number;
      longitude?: number;
      admin1?: string;
    }[];
  };

  return (payload.results ?? []).flatMap((result) => {
    if (!result.id || !result.name || !result.country || !result.country_code || !result.timezone
      || typeof result.latitude !== 'number' || typeof result.longitude !== 'number') return [];
    const countryCode = result.country_code.toUpperCase();
    return [{
      id: `${result.id}:${countryCode}`,
      cityName: result.name,
      countryName: result.country,
      countryCode,
      timeZone: result.timezone,
      currency: currencyForCountryCode(countryCode),
      latitude: result.latitude,
      longitude: result.longitude,
      adminArea: result.admin1,
    }];
  });
}
