import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { ActionButton, FormField } from '@/components/form-controls';
import { TextInput } from 'react-native';
import { AuthScreen } from '@/features/auth/auth-screen';
import { sendEmailOtp, signInWithGoogle } from '@/features/auth/auth-service';

jest.mock('@/global.css', () => ({}));
jest.mock('expo-router', () => ({ Link: 'Link', useLocalSearchParams: () => ({}) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/components/google-mark', () => ({ GoogleMark: () => null }));
jest.mock('@/features/auth/auth-provider', () => ({ useAuth: () => ({ capabilities: { google: true, phone: false } }) }));
jest.mock('@/features/i18n/i18n-provider', () => ({ useI18n: () => ({ locale: 'en', tx: (_zh: string, en: string) => en, setLocale: jest.fn() }) }));
jest.mock('@/features/auth/auth-service', () => ({ sendEmailOtp: jest.fn(), signInWithGoogle: jest.fn() }));

const send = jest.mocked(sendEmailOtp);
const google = jest.mocked(signInWithGoogle);
let tree: ReactTestRenderer;

beforeEach(() => { jest.clearAllMocks(); act(() => { tree = create(<AuthScreen />); }); });
afterEach(() => act(() => tree.unmount()));

it('uses the visible field label as the input accessible name', () => {
  const input = tree.root.findByType(TextInput);
  expect(input.props.accessibilityLabel).toBe('Email');
});

it('keeps the pending login attempt on the same path and address, then permits retry after failure', async () => {
  let reject!: (error: Error) => void;
  send.mockReturnValue(new Promise((_resolve, fail) => { reject = fail; }));
  act(() => tree.root.findByType(FormField).props.onChangeText('traveller@example.com'));
  act(() => tree.root.findByType(ActionButton).props.onPress());
  expect(send).toHaveBeenCalledWith('traveller@example.com', false);
  expect(tree.root.findByType(FormField).props.editable).toBe(false);
  const alternatives = tree.root.findAll((node) => node.props.label === 'Create an account' || node.props.label === 'Sign in with a password');
  expect(alternatives).toHaveLength(2);
  alternatives.forEach((node) => expect(node.props.disabled).toBe(true));
  await act(async () => { reject(new Error('Network unavailable')); });
  expect(tree.root.findByType(FormField).props.editable).toBe(true);
  expect(tree.root.findByType(FormField).props.value).toBe('traveller@example.com');
  act(() => alternatives.find((node) => node.props.label === 'Create an account')?.props.onPress());
  send.mockResolvedValue('traveller@example.com');
  await act(async () => tree.root.findByType(ActionButton).props.onPress());
  expect(send).toHaveBeenLastCalledWith('traveller@example.com', true);
});

it('unlocks sign-in after a cancelled native Google session resolves', async () => {
  google.mockResolvedValue(undefined);
  const provider = tree.root.findByProps({ accessibilityLabel: 'Continue with Google' });
  expect(provider).toBeDefined();
  await act(async () => provider?.props.onPress());
  expect(google).toHaveBeenCalledTimes(1);
  expect(tree.root.findByType(FormField).props.editable).toBe(true);
});
