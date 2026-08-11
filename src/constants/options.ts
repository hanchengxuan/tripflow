import type { ItineraryKind, TripRole } from '@/domain/models';

export const currencyOptions = [
  { value: 'CNY', label: '人民币（CNY）' },
  { value: 'HKD', label: '港币（HKD）' },
  { value: 'JPY', label: '日元（JPY）' },
  { value: 'USD', label: '美元（USD）' },
  { value: 'EUR', label: '欧元（EUR）' },
  { value: 'AUD', label: '澳元（AUD）' },
  { value: 'GBP', label: '英镑（GBP）' },
  { value: 'KRW', label: '韩元（KRW）' },
  { value: 'SGD', label: '新加坡元（SGD）' },
  { value: 'TWD', label: '新台币（TWD）' },
  { value: 'MOP', label: '澳门元（MOP）' },
] as const;

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

export const tripRoleLabels: Record<TripRole, string> = {
  owner: '创建者',
  editor: '可编辑',
  viewer: '仅查看',
};
