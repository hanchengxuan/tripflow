import type { ItineraryKind, TripRole } from '@/domain/models';

const currencyNames: Record<string, [string, string]> = {
  CNY: ['人民币', 'Chinese yuan'], HKD: ['港币', 'Hong Kong dollar'], JPY: ['日元', 'Japanese yen'],
  USD: ['美元', 'US dollar'], EUR: ['欧元', 'Euro'], AUD: ['澳元', 'Australian dollar'],
  GBP: ['英镑', 'British pound'], KRW: ['韩元', 'Korean won'], SGD: ['新加坡元', 'Singapore dollar'],
  TWD: ['新台币', 'New Taiwan dollar'], MOP: ['澳门元', 'Macanese pataca'],
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
  { value: 'Australia/Sydney', label: '澳大利亚（悉尼时间）' },
  { value: 'Europe/London', label: '英国（伦敦时间）' },
  { value: 'America/Los_Angeles', label: '美国（洛杉矶时间）' },
] as const;

const englishTimeZones: Record<string, string> = {
  'Asia/Shanghai': 'Mainland China (Shanghai)', 'Asia/Hong_Kong': 'Hong Kong', 'Asia/Macau': 'Macao',
  'Asia/Taipei': 'Taipei', 'Asia/Tokyo': 'Japan (Tokyo)', 'Asia/Seoul': 'South Korea (Seoul)',
  'Asia/Singapore': 'Singapore', 'Australia/Sydney': 'Australia (Sydney)', 'Europe/London': 'United Kingdom (London)',
  'America/Los_Angeles': 'United States (Los Angeles)',
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
