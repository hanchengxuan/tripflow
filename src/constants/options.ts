import type { ItineraryKind, TripRole } from '@/domain/models';

const currencyNames: Record<string, [string, string]> = {
  CNY: ['人民币', 'Chinese yuan'], HKD: ['港币', 'Hong Kong dollar'], JPY: ['日元', 'Japanese yen'],
  USD: ['美元', 'US dollar'], EUR: ['欧元', 'Euro'], AUD: ['澳元', 'Australian dollar'],
  GBP: ['英镑', 'British pound'], KRW: ['韩元', 'Korean won'], SGD: ['新加坡元', 'Singapore dollar'],
  TWD: ['新台币', 'New Taiwan dollar'], MOP: ['澳门元', 'Macanese pataca'], AED: ['阿联酋迪拉姆', 'UAE dirham'],
  CAD: ['加拿大元', 'Canadian dollar'], CHF: ['瑞士法郎', 'Swiss franc'], DKK: ['丹麦克朗', 'Danish krone'],
  IDR: ['印尼盾', 'Indonesian rupiah'], INR: ['印度卢比', 'Indian rupee'], MYR: ['马来西亚林吉特', 'Malaysian ringgit'],
  NOK: ['挪威克朗', 'Norwegian krone'], NZD: ['新西兰元', 'New Zealand dollar'], PHP: ['菲律宾比索', 'Philippine peso'],
  PLN: ['波兰兹罗提', 'Polish złoty'], SEK: ['瑞典克朗', 'Swedish krona'], THB: ['泰铢', 'Thai baht'],
  VND: ['越南盾', 'Vietnamese dong'], ZAR: ['南非兰特', 'South African rand'],
};

export const currencyCodes = Object.keys(currencyNames);
export const currencyOptions = currencyCodes.map((value) => ({ value, label: `${currencyNames[value][0]}（${value}）` }));
export const getCurrencyOptions = (english: boolean) => currencyCodes.map((value) => ({
  value,
  label: `${currencyNames[value][english ? 1 : 0]} (${value})`,
}));

export const timeZoneOptions = [
  { value: 'Asia/Shanghai', label: '中国大陆（上海时间）' },
  { value: 'Asia/Hong_Kong', label: '中国香港' },
  { value: 'Asia/Macau', label: '中国澳门' },
  { value: 'Asia/Taipei', label: '中国台北' },
  { value: 'Asia/Tokyo', label: '日本（东京时间）' },
  { value: 'Asia/Seoul', label: '韩国（首尔时间）' },
  { value: 'Asia/Singapore', label: '新加坡' },
  { value: 'Asia/Bangkok', label: '泰国（曼谷时间）' },
  { value: 'Asia/Kuala_Lumpur', label: '马来西亚（吉隆坡时间）' },
  { value: 'Asia/Jakarta', label: '印度尼西亚（雅加达时间）' },
  { value: 'Asia/Kolkata', label: '印度（加尔各答时间）' },
  { value: 'Asia/Dubai', label: '阿联酋（迪拜时间）' },
  { value: 'Australia/Sydney', label: '澳大利亚（悉尼时间）' },
  { value: 'Pacific/Auckland', label: '新西兰（奥克兰时间）' },
  { value: 'Europe/London', label: '英国（伦敦时间）' },
  { value: 'Europe/Paris', label: '法国（巴黎时间）' },
  { value: 'Europe/Berlin', label: '德国（柏林时间）' },
  { value: 'America/Los_Angeles', label: '美国（洛杉矶时间）' },
  { value: 'America/New_York', label: '美国（纽约时间）' },
  { value: 'America/Toronto', label: '加拿大（多伦多时间）' },
] as const;

const englishTimeZones: Record<string, string> = {
  'Asia/Shanghai': 'Mainland China (Shanghai)', 'Asia/Hong_Kong': 'Hong Kong', 'Asia/Macau': 'Macao',
  'Asia/Taipei': 'Taipei', 'Asia/Tokyo': 'Japan (Tokyo)', 'Asia/Seoul': 'South Korea (Seoul)',
  'Asia/Singapore': 'Singapore', 'Asia/Bangkok': 'Thailand (Bangkok)', 'Asia/Kuala_Lumpur': 'Malaysia (Kuala Lumpur)',
  'Asia/Jakarta': 'Indonesia (Jakarta)', 'Asia/Kolkata': 'India (Kolkata)', 'Asia/Dubai': 'UAE (Dubai)',
  'Australia/Sydney': 'Australia (Sydney)', 'Pacific/Auckland': 'New Zealand (Auckland)',
  'Europe/London': 'United Kingdom (London)', 'Europe/Paris': 'France (Paris)', 'Europe/Berlin': 'Germany (Berlin)',
  'America/Los_Angeles': 'United States (Los Angeles)', 'America/New_York': 'United States (New York)',
  'America/Toronto': 'Canada (Toronto)',
};
export const getTimeZoneOptions = (english: boolean) => timeZoneOptions.map((option) => ({
  value: option.value,
  label: english ? englishTimeZones[option.value] : option.label,
}));

export const itineraryKinds: ItineraryKind[] = [
  'transport',
  'lodging',
  'food',
  'activity',
  'note',
  'task',
];

export const itineraryKindLabels: Record<ItineraryKind, string> = {
  transport: '交通',
  lodging: '住宿',
  food: '餐饮',
  activity: '活动',
  note: '备注',
  task: '任务',
};

export const itineraryKindLabelsEn: Record<ItineraryKind, string> = {
  transport: 'Transport', lodging: 'Stay', food: 'Food', activity: 'Activity', note: 'Note', task: 'Task',
};

export const tripRoleLabels: Record<TripRole, string> = {
  owner: '创建者',
  editor: '可编辑',
  viewer: '仅查看',
};

export const tripRoleLabelsEn: Record<TripRole, string> = {
  owner: 'Owner', editor: 'Can edit', viewer: 'View only',
};
