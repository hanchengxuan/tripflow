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

export interface DestinationSearchContext {
  tripName?: string;
  planTitle?: string;
  locationName?: string;
}

interface DestinationHint {
  aliases: readonly string[];
  query: string;
  countryCodes: readonly string[];
}

interface CountryHint {
  aliases: readonly string[];
  countryCode: string;
}

/**
 * These are intentionally small, high-confidence aliases for common travel
 * destinations. Open-Meteo remains the source of coordinates and metadata;
 * the local layer only helps the geocoder understand what the traveller meant.
 */
const destinationHints: readonly DestinationHint[] = [
  { aliases: ['东京', '東京', 'tokyo', '日本东京', '東京日本'], query: 'Tokyo', countryCodes: ['JP'] },
  { aliases: ['大阪', '大阪市', 'osaka', '日本大阪'], query: 'Osaka', countryCodes: ['JP'] },
  { aliases: ['京都', 'kyoto', '日本京都'], query: 'Kyoto', countryCodes: ['JP'] },
  { aliases: ['香港', 'hongkong', 'hong kong'], query: 'Hong Kong', countryCodes: ['HK'] },
  { aliases: ['澳门', '澳門', 'macau', 'macao'], query: 'Macao', countryCodes: ['MO'] },
  { aliases: ['台北', '臺北', 'taipei'], query: 'Taipei', countryCodes: ['TW'] },
  { aliases: ['首尔', '首爾', 'seoul'], query: 'Seoul', countryCodes: ['KR'] },
  { aliases: ['新加坡', 'singapore'], query: 'Singapore', countryCodes: ['SG'] },
  { aliases: ['曼谷', 'bangkok'], query: 'Bangkok', countryCodes: ['TH'] },
  { aliases: ['伦敦', '倫敦', 'london'], query: 'London', countryCodes: ['GB'] },
  { aliases: ['巴黎', 'paris'], query: 'Paris', countryCodes: ['FR'] },
  { aliases: ['罗马', '羅馬', 'rome'], query: 'Rome', countryCodes: ['IT'] },
  { aliases: ['米兰', '米蘭', 'milan'], query: 'Milan', countryCodes: ['IT'] },
  { aliases: ['柏林', 'berlin'], query: 'Berlin', countryCodes: ['DE'] },
  { aliases: ['阿姆斯特丹', 'amsterdam'], query: 'Amsterdam', countryCodes: ['NL'] },
  { aliases: ['巴塞罗那', '巴塞隆納', 'barcelona'], query: 'Barcelona', countryCodes: ['ES'] },
  { aliases: ['伊斯坦布尔', '伊斯坦堡', 'istanbul'], query: 'Istanbul', countryCodes: ['TR'] },
  { aliases: ['纽约', '紐約', 'new york', 'newyork'], query: 'New York', countryCodes: ['US'] },
  { aliases: ['洛杉矶', '洛杉磯', 'los angeles', 'losangeles'], query: 'Los Angeles', countryCodes: ['US'] },
  { aliases: ['旧金山', '舊金山', 'san francisco', 'sanfrancisco'], query: 'San Francisco', countryCodes: ['US'] },
  { aliases: ['悉尼', '雪梨', 'sydney'], query: 'Sydney', countryCodes: ['AU'] },
  { aliases: ['墨尔本', '墨爾本', 'melbourne'], query: 'Melbourne', countryCodes: ['AU'] },
  { aliases: ['温哥华', '溫哥華', 'vancouver'], query: 'Vancouver', countryCodes: ['CA'] },
  { aliases: ['多伦多', '多倫多', 'toronto'], query: 'Toronto', countryCodes: ['CA'] },
];

const countryHints: readonly CountryHint[] = [
  { aliases: ['中国', '中國', 'china'], countryCode: 'CN' },
  { aliases: ['日本', 'japan'], countryCode: 'JP' },
  { aliases: ['韩国', '韓國', '南韩', '南韓', 'south korea', 'korea'], countryCode: 'KR' },
  { aliases: ['中国香港', '香港', 'hong kong', 'hongkong'], countryCode: 'HK' },
  { aliases: ['中国澳门', '澳门', '澳門', 'macao', 'macau'], countryCode: 'MO' },
  { aliases: ['中国台湾', '台灣', '台湾', '臺灣', 'taiwan'], countryCode: 'TW' },
  { aliases: ['新加坡', 'singapore'], countryCode: 'SG' },
  { aliases: ['泰国', '泰國', 'thailand'], countryCode: 'TH' },
  { aliases: ['英国', '英國', '英国伦敦', 'united kingdom', 'uk', 'england'], countryCode: 'GB' },
  { aliases: ['法国', '法國', 'france'], countryCode: 'FR' },
  { aliases: ['德国', '德國', 'germany'], countryCode: 'DE' },
  { aliases: ['意大利', '義大利', 'italy'], countryCode: 'IT' },
  { aliases: ['西班牙', 'spain'], countryCode: 'ES' },
  { aliases: ['美国', '美國', '美国', 'united states', 'usa', 'us'], countryCode: 'US' },
  { aliases: ['加拿大', 'canada'], countryCode: 'CA' },
  { aliases: ['澳大利亚', '澳洲', 'australia'], countryCode: 'AU' },
];

/**
 * Open-Meteo's geocoder gives us the city, country, timezone, and coordinates
 * without a key. Currency is deliberately kept as a small local lookup: the
 * geocoder does not return it, and this avoids a second request for every
 * suggestion just to render a sensible default.
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

function normalizeSearchText(value: string) {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\s·,，.。/_-]+/g, '');
}

function countryCodesMentioned(value: string) {
  const normalized = normalizeSearchText(value);
  const codes = new Set<string>();
  for (const hint of [...destinationHints, ...countryHints.map((country) => ({
    aliases: country.aliases,
    countryCodes: [country.countryCode],
  }))]) {
    if (hint.aliases.some((alias) => normalized.includes(normalizeSearchText(alias)))) {
      hint.countryCodes.forEach((code) => codes.add(code));
    }
  }
  return codes;
}

export function currencyForCountryCode(countryCode: string) {
  return currencyByCountryCode[countryCode.trim().toUpperCase()];
}

export function destinationLabel(destination: Pick<DestinationSuggestion, 'cityName' | 'countryName'>) {
  return [destination.cityName, destination.countryName].join(' · ');
}

export function projectDestination(latitude: number, longitude: number) {
  const x = ((longitude + 180) / 360) * 1010;
  const y = Math.max(18, Math.min(666 - 18, ((90 - latitude) / 180) * 666 + 150));
  return { x, y };
}

export function destinationQueryVariants(input: string) {
  const query = input.trim();
  if (!query) return [];
  const normalized = normalizeSearchText(query);
  const variants = [query];
  const hint = destinationHints.find(({ aliases }) => aliases.some((alias) => normalizeSearchText(alias) === normalized));
  if (hint && !variants.some((variant) => normalizeSearchText(variant) === normalizeSearchText(hint.query))) {
    variants.push(hint.query);
  }
  return variants;
}

export function rankDestinationSuggestions(
  input: string,
  suggestions: DestinationSuggestion[],
  context: DestinationSearchContext = {},
) {
  const query = normalizeSearchText(input);
  const hint = destinationHints.find(({ aliases }) => aliases.some((alias) => normalizeSearchText(alias) === query));
  const contextText = [context.tripName, context.planTitle, context.locationName].filter(Boolean).join(' ');
  const contextCountryCodes = countryCodesMentioned(contextText);
  const canonicalCity = hint ? normalizeSearchText(hint.query) : undefined;

  return suggestions
    .map((suggestion, index) => {
      const city = normalizeSearchText(suggestion.cityName);
      const country = normalizeSearchText(suggestion.countryName);
      const adminArea = normalizeSearchText(suggestion.adminArea ?? '');
      const countryCode = suggestion.countryCode.toUpperCase();
      let score = 0;

      if (city === query) score += 1000;
      else if (city.startsWith(query)) score += 520;
      else if (city.includes(query)) score += 280;
      if (country === query) score += 760;
      else if (country.startsWith(query)) score += 360;
      if (adminArea === query) score += 180;
      if (canonicalCity && city === canonicalCity) score += 260;
      if (hint?.countryCodes.includes(countryCode)) score += 300;
      if (contextCountryCodes.has(countryCode)) score += 440;
      if (contextText && (normalizeSearchText(contextText).includes(city) || normalizeSearchText(contextText).includes(country))) score += 140;

      return { suggestion, index, score };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ suggestion }) => suggestion);
}

interface GeocoderResult {
  id?: number;
  name?: string;
  country?: string;
  country_code?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
  admin1?: string;
}

async function fetchDestinationResults(query: string, language: string) {
  const url = 'https://geocoding-api.open-meteo.com/v1/search?name='
    + encodeURIComponent(query)
    + '&count=8&language='
    + language
    + '&format=json';
  const response = await fetch(url);
  if (!response.ok) throw new Error('Destination search is temporarily unavailable');

  const payload = await response.json() as { results?: GeocoderResult[] };
  return (payload.results ?? []).flatMap((result) => {
    if (!result.id || !result.name || !result.country || !result.country_code || !result.timezone
      || typeof result.latitude !== 'number' || typeof result.longitude !== 'number') return [];
    const countryCode = result.country_code.toUpperCase();
    return [{
      id: String(result.id) + ':' + countryCode,
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

function deduplicateSuggestions(suggestions: DestinationSuggestion[]) {
  const seen = new Set<string>();
  return suggestions.filter((suggestion) => {
    const key = suggestion.countryCode
      + ':'
      + suggestion.cityName
      + ':'
      + suggestion.latitude.toFixed(3)
      + ':'
      + suggestion.longitude.toFixed(3);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function searchDestinations(
  input: string,
  locale: string,
  context: DestinationSearchContext = {},
): Promise<DestinationSuggestion[]> {
  const query = input.trim();
  if (query.length < 2) return [];

  const language = locale === 'zh-CN' ? 'zh' : 'en';
  const languages = language === 'zh' ? ['zh', 'en'] : ['en'];
  const queries = destinationQueryVariants(query);
  const requests = queries.flatMap((variant) => languages.map((requestLanguage) => (
    fetchDestinationResults(variant, requestLanguage)
  )));
  const responses = await Promise.allSettled(requests);
  const successful = responses.flatMap((response) => response.status === 'fulfilled' ? response.value : []);
  if (successful.length === 0 && responses.every((response) => response.status === 'rejected')) {
    throw new Error('Destination search is temporarily unavailable');
  }

  return rankDestinationSuggestions(query, deduplicateSuggestions(successful), context).slice(0, 8);
}
