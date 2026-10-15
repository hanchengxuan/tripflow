import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { ActionButton } from '@/components/form-controls';
import { ItineraryHealthCard } from '@/components/itinerary-health-card';
import { ThemedText } from '@/components/themed-text';
import type { ItineraryItem } from '@/domain/models';

jest.mock('@/global.css', () => ({}));
let mockLocale: 'zh-CN' | 'en' = 'zh-CN';
const mockEn = { locale: 'en', tx: (_zh: string, en: string) => en };
const mockZh = { locale: 'zh-CN', tx: (zh: string) => zh };
jest.mock('@/features/i18n/i18n-provider', () => ({ useI18n: () => mockLocale === 'en' ? mockEn : mockZh }));

const items: ItineraryItem[] = [{
  id: 'first', tripId: 'demo', kind: 'activity', title: 'Museum', routeTravelMode: 'WALK',
  startsAt: '2026-10-20T10:00:00Z', endsAt: '2026-10-20T11:00:00Z',
}];
let tree: ReactTestRenderer;
const texts = () => tree.root.findAllByType(ThemedText).map(({ props }) => props.children).filter((text): text is string => typeof text === 'string');
const flushCheck = async () => { await act(async () => { jest.runOnlyPendingTimers(); }); };

beforeEach(() => {
  jest.useFakeTimers();
  mockLocale = 'zh-CN';
  act(() => { tree = create(<ItineraryHealthCard items={items} />); });
});
afterEach(() => { act(() => tree.unmount()); jest.useRealTimers(); });

it('discards the old-language report immediately and regenerates it for unchanged items', async () => {
  await flushCheck();
  expect(texts()).toContain('发现 1 个需要处理的行程问题。');
  mockLocale = 'en';
  act(() => tree.update(<ItineraryHealthCard items={items} />));
  expect(texts()).not.toContain('发现 1 个需要处理的行程问题。');
  await flushCheck();
  expect(texts()).toContain('1 itinerary issue needs attention.');
  expect(texts().join(' ')).not.toMatch(/[㐀-鿿]/u);
  mockLocale = 'zh-CN';
  act(() => tree.update(<ItineraryHealthCard items={items} />));
  await flushCheck();
  expect(texts()).toContain('这项安排没有地点，出发前可能需要补充。');
});

it('uses the active language when checking again', async () => {
  mockLocale = 'en';
  act(() => tree.update(<ItineraryHealthCard items={items} />));
  await flushCheck();
  await act(async () => { await tree.root.findByType(ActionButton).props.onPress(); });
  expect(texts()).toContain('1 itinerary issue needs attention.');
  expect(texts()).toContain('This plan has no location. Add one before you leave.');
});
