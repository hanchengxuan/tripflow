import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { DelayShiftSheet } from '@/components/delay-shift-sheet';
import { ItineraryComposerSheet } from '@/components/itinerary-composer-sheet';
import { SettingsRow } from '@/components/settings-list';
import { ActionButton, ChoiceChip, InlineNotice } from '@/components/form-controls';
import type { ItineraryItem } from '@/domain/models';

jest.mock('@/components/location-field', () => ({ LocationField: () => null }));
jest.mock('@/components/destination-field', () => ({ DestinationField: () => null }));
jest.mock('@/global.css', () => ({}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/features/i18n/i18n-provider', () => ({ useI18n: () => ({ locale: 'en', languageTag: 'en-US', tx: (_zh: string, en: string) => en }) }));

const plan = (id: string, startsAt: string, endsAt: string) => ({ id, tripId: 't', kind: 'activity', title: id, startsAt, endsAt, routeTravelMode: 'WALK' }) satisfies ItineraryItem;
const mockLunch = plan('Lunch', '2026-10-21T03:00:00Z', '2026-10-21T04:00:00Z');
const mockMuseum = plan('Museum', '2026-10-21T04:30:00Z', '2026-10-21T06:00:00Z');
const mockShift = jest.fn(async () => {});
let mockTripEnd = '2026-10-25';
let mockItems: ItineraryItem[] = [];
jest.mock('@/features/mvp/mvp-provider', () => ({
  useMvp: () => ({
    activeTrip: { id: 't', startsOn: '2026-10-20', endsOn: mockTripEnd, defaultTimeZone: 'Asia/Tokyo' },
    itineraryItems: mockItems,
    shiftItineraryItems: mockShift,
  }),
}));

let tree: ReactTestRenderer;
const onDone = jest.fn();
const applyButton = () => tree.root.findByType(ActionButton);
const render = (item: ItineraryItem = mockLunch) => act(() => { tree = create(<DelayShiftSheet item={item} visible onDismiss={jest.fn()} onDone={onDone} />); });

beforeEach(() => { jest.clearAllMocks(); mockTripEnd = '2026-10-25'; mockItems = [mockLunch, mockMuseum]; });
afterEach(() => act(() => tree.unmount()));

it('previews every moved plan and applies them together', async () => {
  render();
  act(() => tree.root.findAllByType(ChoiceChip).find((chip) => chip.props.children === '2 hr')?.props.onPress());
  expect(applyButton().props.children).toBe('Move 2 plans later');
  await act(async () => applyButton().props.onPress());
  expect(mockShift).toHaveBeenCalledWith([
    expect.objectContaining({ item: mockLunch, startsAt: '2026-10-21T05:00:00.000Z' }),
    expect.objectContaining({ item: mockMuseum, startsAt: '2026-10-21T06:30:00.000Z' }),
  ]);
  expect(onDone).toHaveBeenCalledWith('Moved 2 plans later.');
});

it('refuses a delay that would push a plan past the trip', () => {
  mockTripEnd = '2026-10-21';
  const lateDinner = plan('Late dinner', '2026-10-21T12:00:00Z', '2026-10-21T13:30:00Z');
  mockItems = [lateDinner];
  render(lateDinner);
  act(() => tree.root.findAllByType(ChoiceChip).find((chip) => chip.props.children === '3 hr')?.props.onPress());
  expect(applyButton().props.disabled).toBe(true);
});


it('keeps the preview fixed while saving', async () => {
  let finish = () => {};
  mockShift.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  render();
  let saving: Promise<void>;
  act(() => { saving = applyButton().props.onPress(); });
  expect(tree.root.findAllByType(ChoiceChip).every((chip) => chip.props.disabled)).toBe(true);
  await act(async () => { finish(); await saving; });
});

it('blocks a preview larger than the atomic server limit', () => {
  mockItems = Array.from({ length: 31 }, (_, index) => plan(`Plan ${index}`, '2026-10-21T03:00:00Z', '2026-10-21T03:01:00Z'));
  render(mockItems[0]);
  expect(applyButton().props.disabled).toBe(true);
});


it('does not claim rollback when the update cannot be confirmed', async () => {
  mockShift.mockRejectedValueOnce(new Error('Network request failed'));
  render();
  await act(async () => applyButton().props.onPress());
  expect(onDone).not.toHaveBeenCalled();
  expect(tree.root.findAllByType(InlineNotice).some((notice) => typeof notice.props.children === 'string')).toBe(true);
  expect(JSON.stringify(tree.toJSON())).not.toContain('Nothing was moved');
  expect(applyButton().props.busy).toBe(false);
});

it('keeps a failed delay visible when refreshed plan objects arrive', async () => {
  const trip = { id: 't', createdBy: 'owner', name: 'Tokyo', startsOn: '2026-10-20', endsOn: '2026-10-25', homeCurrency: 'JPY', defaultTimeZone: 'Asia/Tokyo' };
  const dismiss = jest.fn();
  const props = { activeTrip: trip, itineraryItems: mockItems, onAdd: jest.fn(), onDelete: jest.fn(), onDismiss: dismiss, onExtendTrip: jest.fn(), onSave: jest.fn(), visible: true };
  const settle = async () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  await act(async () => { tree = create(<ItineraryComposerSheet {...props} editingItem={mockLunch} />); });
  await settle();
  act(() => tree.root.findAllByType(SettingsRow).find((row) => row.props.label === 'Delayed? Move later plans')?.props.onPress());
  mockShift.mockRejectedValueOnce(new Error('offline'));
  await act(async () => applyButton().props.onPress());
  await act(async () => { tree.update(<ItineraryComposerSheet {...props} editingItem={{ ...mockLunch }} itineraryItems={mockItems.map((item) => ({ ...item }))} />); });
  await settle();
  expect(tree.root.findAllByType(DelayShiftSheet)).toHaveLength(1);
  expect(JSON.stringify(tree.toJSON())).toContain('Could not confirm the update');
  expect(dismiss).not.toHaveBeenCalled();
  await act(async () => { tree.update(<ItineraryComposerSheet {...props} editingItem={mockMuseum} />); });
  await settle();
  expect(tree.root.findAllByType(DelayShiftSheet)).toHaveLength(0);
});
