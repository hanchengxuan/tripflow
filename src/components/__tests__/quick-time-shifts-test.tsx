import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { ActionButton, ChoiceChip } from '@/components/form-controls';
import { ItineraryComposerSheet } from '@/components/itinerary-composer-sheet';
import { QuickTimeShifts } from '@/components/quick-time-shifts';
import type { ItineraryItem, Trip } from '@/domain/models';

jest.mock('@/global.css', () => ({}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/features/i18n/i18n-provider', () => ({ useI18n: () => ({ locale: 'en', languageTag: 'en-US', tx: (_zh: string, en: string) => en, formatDateTime: (value: string) => value }) }));
jest.mock('@/components/location-field', () => ({ LocationField: () => null }));
jest.mock('@/components/destination-field', () => ({ DestinationField: () => null }));

const trip: Trip = { id: 'trip-1', createdBy: 'owner-1', name: 'Tokyo', startsOn: '2026-10-20', endsOn: '2026-10-25', homeCurrency: 'JPY', defaultTimeZone: 'Asia/Tokyo' };
const dinner = {
  id: 'item-1', tripId: 'trip-1', kind: 'food', title: 'Dinner', locationLabel: 'Shibuya',
  startsAt: '2026-10-21T09:30:00.000Z', endsAt: '2026-10-21T11:00:00.000Z',
} as ItineraryItem;

async function render(item: ItineraryItem, onSave: jest.Mock) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <ItineraryComposerSheet
        activeTrip={trip}
        editingItem={item}
        itineraryItems={[item]}
        onAdd={jest.fn()}
        onDelete={jest.fn()}
        onDismiss={jest.fn()}
        onExtendTrip={jest.fn()}
        onSave={onSave}
        visible
      />,
    );
  });
  await settle();
  return tree;
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function unmount(tree: ReactTestRenderer) {
  await settle();
  await act(async () => tree.unmount());
}

const chip = (tree: ReactTestRenderer, label: string) => tree.root.findAllByType(ChoiceChip).find((node) => node.props.children === label);

it('saves a plan moved 30 minutes later with one tap', async () => {
  const onSave = jest.fn(async () => {});
  const tree = await render(dinner, onSave);

  act(() => chip(tree, '30 min later')?.props.onPress());
  await act(async () => tree.root.findAllByType(ActionButton).find((button) => button.props.children === 'Save')?.props.onPress());

  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    itemId: 'item-1',
    startsAt: '2026-10-21T10:00:00.000Z',
    endsAt: '2026-10-21T11:30:00.000Z',
  }));
  await unmount(tree);
});

it('does not save anything until the traveller presses save', async () => {
  const onSave = jest.fn(async () => {});
  const tree = await render(dinner, onSave);
  act(() => chip(tree, 'Next day')?.props.onPress());
  expect(onSave).not.toHaveBeenCalled();
  await unmount(tree);
});

it('hides quick shifts for a stay transfer, whose end is tied to the stay', async () => {
  const tree = await render({ ...dinner, linkedStayId: 'stay-1' } as ItineraryItem, jest.fn());
  expect(tree.root.findAllByType(QuickTimeShifts)).toHaveLength(0);
  await unmount(tree);
});
