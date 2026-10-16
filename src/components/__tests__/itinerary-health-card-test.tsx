import { useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { BottomSheet } from '@/components/bottom-sheet';
import { ActionButton } from '@/components/form-controls';
import { HealthFixSuggestion } from '@/components/health-fix-suggestion';
import { ItineraryHealthHint, ItineraryHealthSheet } from '@/components/itinerary-health-card';
import { ThemedText } from '@/components/themed-text';
import type { ItineraryItem } from '@/domain/models';
import type { HealthFix } from '@/features/ai/itinerary-health-fix';
import { useItineraryHealth } from '@/features/ai/use-itinerary-health';

jest.mock('@/global.css', () => ({}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
let mockLocale: 'zh-CN' | 'en' = 'en';
const mockEn = { locale: 'en', languageTag: 'en-US', tx: (_zh: string, en: string) => en };
const mockZh = { locale: 'zh-CN', languageTag: 'zh-CN', tx: (zh: string) => zh };
jest.mock('@/features/i18n/i18n-provider', () => ({ useI18n: () => mockLocale === 'en' ? mockEn : mockZh }));

const trip = { startsOn: '2026-10-20', endsOn: '2026-10-25', defaultTimeZone: 'Asia/Tokyo' };
const items = [
  { id: 'transfer', tripId: 't', kind: 'transport', title: 'Airport transfer', locationLabel: 'Haneda', startsAt: '2026-10-21T04:30:00Z', endsAt: '2026-10-21T06:00:00Z' },
  { id: 'hotel', tripId: 't', kind: 'lodging', title: 'Hotel', locationLabel: 'Marunouchi', startsAt: '2026-10-21T06:00:00Z', endsAt: '2026-10-24T02:00:00Z' },
  { id: 'museum', tripId: 't', kind: 'activity', title: 'Museum', locationLabel: 'Ueno', startsAt: '2026-10-21T06:10:00Z', endsAt: '2026-10-21T08:00:00Z' },
] as ItineraryItem[];

function Today({ onApply }: { onApply?: (fix: HealthFix) => Promise<void> }) {
  const health = useItineraryHealth(items);
  const [itemId, setItemId] = useState<string>();
  return (
    <>
      {items.map((item) => {
        const issues = health.issuesByItemId.get(item.id);
        return issues ? <ItineraryHealthHint key={item.id} issues={issues} onPress={() => setItemId(item.id)} /> : null;
      })}
      <ItineraryHealthSheet
        health={health}
        items={items}
        itemId={itemId}
        onDismiss={() => setItemId(undefined)}
        onEditItem={onApply ? jest.fn() : undefined}
        fixes={onApply ? { trip, onApply } : undefined}
      />
    </>
  );
}

let tree: ReactTestRenderer;
const texts = () => tree.root.findAllByType(ThemedText).map(({ props }) => props.children).filter((text): text is string => typeof text === 'string');
const sheetOpen = () => tree.root.findAllByType(BottomSheet).some(({ props }) => props.visible);
const flushCheck = async () => { await act(async () => { jest.runOnlyPendingTimers(); }); };
const openHint = (index: number) => act(() => tree.root.findAllByType(ItineraryHealthHint)[index].props.onPress());

beforeEach(() => { jest.useFakeTimers(); mockLocale = 'en'; });
afterEach(() => { act(() => tree.unmount()); jest.useRealTimers(); });

it('marks only the flagged plans and keeps the details closed until a hint is tapped', async () => {
  act(() => { tree = create(<Today onApply={jest.fn(async () => {})} />); });
  await flushCheck();

  expect(tree.root.findAllByType(ItineraryHealthHint).map(({ props }) => props.issues[0].itemIds)).toEqual([
    ['transfer', 'museum'],
    ['transfer', 'museum'],
  ]);
  expect(texts()).toContain('Tight buffer');
  expect(sheetOpen()).toBe(false);

  openHint(1);
  expect(sheetOpen()).toBe(true);
  expect(texts()).toContain('Short gap between plans');
});

it('applies the tight-gap fix from the opened sheet', async () => {
  const onApply = jest.fn(async () => {});
  act(() => { tree = create(<Today onApply={onApply} />); });
  await flushCheck();
  openHint(0);

  const apply = tree.root.findAllByType(ActionButton).find((button) => button.props.children === 'Apply suggestion');
  await act(async () => apply?.props.onPress());

  expect(onApply).toHaveBeenCalledWith(expect.objectContaining({
    candidate: expect.objectContaining({ id: 'museum', startsAt: '2026-10-21T06:30:00.000Z', endsAt: '2026-10-21T08:20:00.000Z' }),
  }));
});

it('shows no fix to a view-only traveller', async () => {
  act(() => { tree = create(<Today />); });
  await flushCheck();
  openHint(0);
  expect(tree.root.findAllByType(HealthFixSuggestion)).toHaveLength(0);
  expect(texts()).toContain('You have view-only access. Ask an editor to make the change.');
});

it('regenerates the check in the active language', async () => {
  mockLocale = 'zh-CN';
  act(() => { tree = create(<Today />); });
  await flushCheck();
  openHint(0);
  expect(texts()).toContain('衔接较紧');

  mockLocale = 'en';
  act(() => tree.update(<Today />));
  await flushCheck();
  expect(texts()).toContain('Tight buffer');
  expect(texts().join(' ')).not.toMatch(/[㐀-鿿]/u);
});
