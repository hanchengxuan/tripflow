import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { ActionButton } from '@/components/form-controls';
import { HealthFixSuggestion } from '@/components/health-fix-suggestion';
import { ItineraryHealthCard } from '@/components/itinerary-health-card';
import type { ItineraryItem } from '@/domain/models';

jest.mock('@/global.css', () => ({}));
jest.mock('@/features/i18n/i18n-provider', () => ({ useI18n: () => ({ locale: 'en', languageTag: 'en-US', tx: (_zh: string, en: string) => en }) }));

const trip = { startsOn: '2026-10-20', endsOn: '2026-10-25', defaultTimeZone: 'Asia/Tokyo' };
const items = [
  { id: 'transfer', tripId: 't', kind: 'transport', title: 'Airport transfer', startsAt: '2026-10-21T04:30:00Z', endsAt: '2026-10-21T06:00:00Z' },
  { id: 'hotel', tripId: 't', kind: 'lodging', title: 'Hotel', locationLabel: 'Marunouchi', startsAt: '2026-10-21T06:00:00Z', endsAt: '2026-10-24T02:00:00Z' },
] as ItineraryItem[];

let tree: ReactTestRenderer;
const flushCheck = async () => { await act(async () => { jest.runOnlyPendingTimers(); }); };

beforeEach(() => jest.useFakeTimers());
afterEach(() => { act(() => tree.unmount()); jest.useRealTimers(); });

it('offers a tight-gap fix and applies the moved plan in one tap', async () => {
  const onApply = jest.fn(async () => {});
  act(() => { tree = create(<ItineraryHealthCard items={items} onEditItem={jest.fn()} fixes={{ trip, onApply }} />); });
  await flushCheck();

  const apply = tree.root.findAllByType(ActionButton).find((button) => button.props.children === 'Apply suggestion');
  await act(async () => apply?.props.onPress());

  expect(onApply).toHaveBeenCalledWith(expect.objectContaining({
    candidate: expect.objectContaining({ id: 'hotel', startsAt: '2026-10-21T06:30:00.000Z', endsAt: '2026-10-24T02:00:00.000Z' }),
  }));
});

it('shows no fix to a view-only traveller', async () => {
  act(() => { tree = create(<ItineraryHealthCard items={items} />); });
  await flushCheck();
  expect(tree.root.findAllByType(HealthFixSuggestion)).toHaveLength(0);
});
