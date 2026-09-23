import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import ProfileScreen from '@/app/profile';
import { ConfirmSheet } from '@/components/confirm-sheet';
import { ProfileEditSheet } from '@/components/profile-edit-sheet';
import { SettingsRow } from '@/components/settings-list';
import { SignInMethodsSheet } from '@/components/sign-in-methods-sheet';
import { deleteAccount, linkGoogleIdentity, signOut } from '@/features/auth/auth-service';

const mockSave = jest.fn();
jest.mock('@/global.css', () => ({}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/features/i18n/i18n-provider', () => ({ useI18n: () => ({ locale: 'en', tx: (_zh: string, en: string) => en, setLocale: jest.fn() }) }));
jest.mock('@/features/auth/auth-provider', () => ({ useAuth: () => ({ capabilities: { google: true, phone: false }, session: { user: { email: 'traveller@example.com', identities: [] } } }) }));
jest.mock('@/features/mvp/mvp-provider', () => ({ useMvp: () => ({ profile: { displayName: 'Traveller' }, members: [], saveProfile: mockSave }) }));
jest.mock('@/features/auth/auth-service', () => ({ signOut: jest.fn(), deleteAccount: jest.fn(), linkGoogleIdentity: jest.fn() }));
let tree: ReactTestRenderer;
beforeEach(() => { jest.clearAllMocks(); act(() => { tree = create(<ProfileScreen />); }); });
afterEach(() => act(() => tree.unmount()));
function open(label: string) {
  act(() => tree.root.findAllByType(SettingsRow).find((node) => node.props.label === label)?.props.onPress());
}

it('keeps failed profile edits visible for retry and closes only after saving succeeds', async () => {
  open('Traveller');
  let sheet = tree.root.findByType(ProfileEditSheet);
  act(() => sheet.props.onChangeName('New name'));
  mockSave.mockRejectedValueOnce(new Error('Save unavailable'));
  await act(async () => sheet.props.onSave());
  sheet = tree.root.findByType(ProfileEditSheet);
  expect(sheet.props.visible).toBe(true);
  expect(sheet.props.error).toBe('Could not save your profile. Please try again.');
  expect(sheet.props.draftName).toBe('New name');
  expect(sheet.props.busy).toBe(false);
  mockSave.mockResolvedValueOnce(undefined);
  await act(async () => sheet.props.onSave());
  expect(tree.root.findByType(ProfileEditSheet).props.visible).toBe(false);
  expect(mockSave).toHaveBeenLastCalledWith({ displayName: 'New name', avatar: undefined });
});

it('opens confirmation without signing out or deleting, and cancellation leaves the account untouched', () => {
  for (const label of ['Sign out', 'Delete account']) {
    open(label);
    const sheet = tree.root.findAllByType(ConfirmSheet).find((node) => node.props.visible);
    expect(sheet).toBeDefined();
    act(() => sheet?.props.onDismiss());
  }
  expect(signOut).not.toHaveBeenCalled();
  expect(deleteAccount).not.toHaveBeenCalled();
});

it('unlocks the identity sheet after native Google linking is cancelled', async () => {
  jest.mocked(linkGoogleIdentity).mockResolvedValue(undefined);
  open('Sign-in methods');
  const sheet = tree.root.findByType(SignInMethodsSheet);
  await act(async () => sheet.props.onLinkGoogle());
  expect(linkGoogleIdentity).toHaveBeenCalledTimes(1);
  expect(tree.root.findByType(SignInMethodsSheet).props.busy).toBe(false);
  expect(tree.root.findByType(SignInMethodsSheet).props.visible).toBe(true);
});
