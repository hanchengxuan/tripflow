import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import TripsScreen from '@/app/explore';
import { ConfirmSheet } from '@/components/confirm-sheet';
import { MemberAccessSheet } from '@/components/member-access-sheet';
import { SettingsRow } from '@/components/settings-list';
import { TripOverviewCard } from '@/components/trip-overview-card';

const mockDeleteTrip = jest.fn<Promise<void>, []>();
const mockRemoveMember = jest.fn<Promise<void>, [string]>();
const mockTrip = { id: 'trip-1', createdBy: 'owner-1', name: 'Japan spring', startsOn: '2026-10-01', endsOn: '2026-10-12', homeCurrency: 'JPY', defaultTimeZone: 'Asia/Tokyo' };
const mockMembers = [
  { tripId: 'trip-1', userId: 'owner-1', displayName: 'Alex Chen', role: 'owner' as const },
  { tripId: 'trip-1', userId: 'traveller-2', displayName: 'Sam Lee', role: 'editor' as const },
];

jest.mock('@/global.css', () => ({}));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({}) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/features/i18n/i18n-provider', () => ({ useI18n: () => ({ locale: 'en', languageTag: 'en-US', tx: (_zh: string, en: string) => en, formatDateTime: (value: string) => value }) }));
jest.mock('@/features/mvp/mvp-provider', () => ({ useMvp: () => ({
  trips: [mockTrip], activeTrip: mockTrip, members: mockMembers, currentUserId: 'owner-1', error: undefined,
  selectTrip: jest.fn(async () => {}), createTrip: jest.fn(async () => {}), joinTrip: jest.fn(async () => {}), createInvite: jest.fn(async () => ({ token: 'a'.repeat(48), expiresAt: '2026-10-10T12:00:00Z' })),
  saveTrip: jest.fn(async () => {}), deleteTrip: mockDeleteTrip, setMemberRole: jest.fn(async () => {}), removeMember: mockRemoveMember,
}) }));
jest.mock('@/components/member-avatar', () => ({ MemberAvatar: () => null }));

let tree: ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  mockDeleteTrip.mockResolvedValue(undefined);
  mockRemoveMember.mockResolvedValue(undefined);
  act(() => { tree = create(<TripsScreen />); });
});
afterEach(() => act(() => tree.unmount()));

async function openManage() {
  await act(async () => tree.root.findByType(TripOverviewCard).props.onManage());
}

it('requires an explicit confirmation before permanently deleting the current trip', async () => {
  await openManage();
  act(() => tree.root.findAllByType(SettingsRow).find((row) => row.props.label === 'Delete trip')?.props.onPress());
  let confirmation = tree.root.findAllByType(ConfirmSheet).find((sheet) => sheet.props.visible);
  expect(confirmation?.props.consequence).toMatch(/All plans, expenses, transfers/);
  act(() => confirmation?.props.onDismiss());
  expect(mockDeleteTrip).not.toHaveBeenCalled();

  act(() => tree.root.findAllByType(SettingsRow).find((row) => row.props.label === 'Delete trip')?.props.onPress());
  confirmation = tree.root.findAllByType(ConfirmSheet).find((sheet) => sheet.props.visible);
  await act(async () => confirmation?.props.onConfirm());
  expect(mockDeleteTrip).toHaveBeenCalledTimes(1);
});

it('keeps traveller removal in a separate confirmation and returns to access on cancel', async () => {
  await openManage();
  act(() => tree.root.findAllByType(SettingsRow).find((row) => row.props.label === 'Sam Lee')?.props.onPress());
  expect(tree.root.findByType(MemberAccessSheet).props.visible).toBe(true);

  act(() => tree.root.findAllByType(SettingsRow).find((row) => row.props.label === 'Remove from trip')?.props.onPress());
  let confirmation = tree.root.findAllByType(ConfirmSheet).find((sheet) => sheet.props.visible);
  expect(confirmation?.props.title).toBe('Remove Sam Lee?');
  act(() => confirmation?.props.onDismiss());
  expect(mockRemoveMember).not.toHaveBeenCalled();
  expect(tree.root.findByType(MemberAccessSheet).props.visible).toBe(true);

  act(() => tree.root.findAllByType(SettingsRow).find((row) => row.props.label === 'Remove from trip')?.props.onPress());
  confirmation = tree.root.findAllByType(ConfirmSheet).find((sheet) => sheet.props.visible);
  await act(async () => confirmation?.props.onConfirm());
  expect(mockRemoveMember).toHaveBeenCalledWith('traveller-2');
});
