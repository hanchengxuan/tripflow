import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { ChatActionCard } from '@/components/chat-action-card';
import { ActionButton } from '@/components/form-controls';
import type { ItineraryItem } from '@/domain/models';

jest.mock('@/global.css', () => ({}));
jest.mock('@/features/i18n/i18n-provider', () => ({ useI18n: () => ({ locale: 'en', languageTag: 'en-US', tx: (_zh: string, en: string) => en }) }));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

const mockLunch = { id: 'lunch', tripId: 't', kind: 'food', title: 'Lunch', startsAt: '2026-11-14T03:00:00Z', endsAt: '2026-11-14T04:00:00Z', routeTravelMode: 'WALK', locationLabel: 'Dotonbori' } as ItineraryItem;
const mockSave = jest.fn(async () => {});
const mockOnStatus = jest.fn();
let mockItems: ItineraryItem[] = [];
const mockAdd = jest.fn(async () => {});
let mockRole = 'editor';
jest.mock('@/features/mvp/mvp-provider', () => ({
  useMvp: () => ({
    activeTrip: { id: 't', defaultTimeZone: 'Asia/Tokyo' },
    itineraryItems: mockItems,
    members: [{ userId: 'me', displayName: 'Me', role: mockRole }, { userId: 'sam', displayName: 'Sam', role: 'viewer' }],
    currentUserId: 'me',
    saveItineraryItem: mockSave,
    addItineraryItem: mockAdd,
  }),
}));

let tree: ReactTestRenderer;
const confirmButton = () => tree.root.findByType(ActionButton);
beforeEach(() => { jest.clearAllMocks(); mockRole = 'editor'; mockItems = [mockLunch]; });
afterEach(() => act(() => tree.unmount()));

it('saves a proposed time change only when confirmed, keeping the plan length', async () => {
  act(() => { tree = create(<ChatActionCard proposal={{ action: { type: 'update_plan', itemId: 'lunch', startLocal: '2026-11-14 13:00' }, status: 'pending' }} onStatus={mockOnStatus} />); });
  expect(mockSave).not.toHaveBeenCalled();
  await act(async () => confirmButton().props.onPress());
  expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
    itemId: 'lunch', title: 'Lunch', startsAt: '2026-11-14T04:00:00.000Z', endsAt: '2026-11-14T05:00:00.000Z', locationLabel: 'Dotonbori',
  }));
  expect(mockOnStatus).toHaveBeenCalledWith('saved');
});

it('after a save and a reopen, shows the original time and no second confirm', () => {
  mockItems = [{ ...mockLunch, startsAt: '2026-11-14T04:00:00Z', endsAt: '2026-11-14T05:00:00Z' }];
  act(() => {
    tree = create(<ChatActionCard
      proposal={{ action: { type: 'update_plan', itemId: 'lunch', startLocal: '2026-11-14 13:00' }, before: { title: 'Lunch', startsAt: mockLunch.startsAt, endsAt: mockLunch.endsAt }, status: 'saved' }}
      onStatus={mockOnStatus}
    />);
  });
  const rendered = JSON.stringify(tree.toJSON());
  expect(rendered).toContain('Sat, Nov 14 · 12:00–13:00');
  expect(rendered).toContain('→ Sat, Nov 14 · 13:00–14:00');
  expect(rendered).toContain('Saved');
  expect(rendered).not.toContain('This plan changed');
  expect(tree.root.findAllByType(ActionButton)).toHaveLength(0);
});

it('lets a viewer see but not confirm a plan change', () => {
  mockRole = 'viewer';
  act(() => { tree = create(<ChatActionCard proposal={{ action: { type: 'update_plan', itemId: 'lunch', title: 'Ramen' }, status: 'pending' }} onStatus={mockOnStatus} />); });
  expect(confirmButton().props.disabled).toBe(true);
});

it('blocks a stay without a place', () => {
  act(() => { tree = create(<ChatActionCard proposal={{ action: { type: 'add_plan', kind: 'lodging', title: 'Hotel', startLocal: '2026-11-14 15:00', endLocal: '2026-11-16 11:00' }, status: 'pending' }} onStatus={mockOnStatus} />); });
  expect(confirmButton().props.disabled).toBe(true);
});

it('opens the ledger prefilled for an expense, defaulting payer and split', async () => {
  act(() => { tree = create(<ChatActionCard proposal={{ action: { type: 'add_expense', title: 'Taxi', amount: '2400', currency: 'JPY' }, status: 'pending' }} onStatus={mockOnStatus} />); });
  await act(async () => confirmButton().props.onPress());
  const { pathname, params } = mockPush.mock.calls[0][0];
  expect(pathname).toBe('/ledger');
  expect(JSON.parse(params.chatDraft)).toMatchObject({ title: 'Taxi', amount: '2400', currency: 'JPY', payerUserId: 'me', participantUserIds: ['me', 'sam'] });
});

it('guards confirmation synchronously and does not repeat a successful addition', async () => {
  let finish: (() => void) | undefined;
  mockAdd.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  act(() => {
    tree = create(<ChatActionCard proposal={{ action: { type: 'add_plan', kind: 'food', title: 'Lunch', startLocal: '2026-11-14 12:00', endLocal: '2026-11-14 13:00' }, status: 'pending' }} onStatus={mockOnStatus} />);
  });
  const press = confirmButton().props.onPress;
  let saving: Promise<void> | undefined;
  act(() => { saving = press(); void press(); });
  expect(mockAdd).toHaveBeenCalledTimes(1);
  await act(async () => { finish?.(); await saving; await press(); });
  expect(mockAdd).toHaveBeenCalledTimes(1);
  expect(mockOnStatus).toHaveBeenCalledWith('saved');
});

it.each([
  { title: 'Ramen' },
  { startsAt: '2026-11-14T04:00:00Z' },
  { endsAt: '2026-11-14T05:00:00Z' },
])('blocks a pending proposal when its original plan changed by %o', async (change) => {
  mockItems = [{ ...mockLunch, ...change }];
  act(() => {
    tree = create(<ChatActionCard
      proposal={{ action: { type: 'update_plan', itemId: 'lunch', startLocal: '2026-11-14 13:00' }, before: { title: mockLunch.title, startsAt: mockLunch.startsAt, endsAt: mockLunch.endsAt }, status: 'pending' }}
      onStatus={mockOnStatus}
    />);
  });
  expect(confirmButton().props.disabled).toBe(true);
  expect(JSON.stringify(tree.toJSON())).toContain('This plan changed');
  await act(async () => confirmButton().props.onPress());
  expect(mockSave).not.toHaveBeenCalled();
});
