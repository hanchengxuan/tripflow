import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { TextInput } from 'react-native';

import { ExpenseQuickFill } from '@/components/expense-quick-fill';

jest.mock('@/global.css', () => ({}));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
let mockVoiceActive = false;
jest.mock('@/components/voice-recording-control', () => ({
  VoiceRecordingControl: ({ render }: { render: (button: null, feedback: null, active: boolean) => React.ReactNode }) => render(null, null, mockVoiceActive),
}));

let tree: ReactTestRenderer;
const fill = jest.fn(async () => undefined);
const scan = jest.fn(async () => undefined);
const props = { text: 'Dinner 860 HKD', onChangeText: jest.fn(), onFill: fill, onAudioReady: jest.fn(), onScanReceipt: scan, busy: false, tx: (_zh: string, en: string) => en };

afterEach(() => { act(() => tree.unmount()); jest.clearAllMocks(); mockVoiceActive = false; });

it('blocks text submission while recording or processing, then allows retry', () => {
  act(() => { tree = create(<ExpenseQuickFill {...props} />); });
  mockVoiceActive = true;
  act(() => tree.update(<ExpenseQuickFill {...props} />));
  expect(tree.root.findByType(TextInput).props.editable).toBe(false);
  expect(tree.root.findByProps({ accessibilityLabel: 'Fill with AI' }).props.disabled).toBe(true);
  act(() => tree.root.findByType(TextInput).props.onSubmitEditing());
  expect(fill).not.toHaveBeenCalled();
  mockVoiceActive = false;
  act(() => tree.update(<ExpenseQuickFill {...props} busy />));
  act(() => tree.root.findByType(TextInput).props.onSubmitEditing());
  expect(fill).not.toHaveBeenCalled();
  act(() => tree.update(<ExpenseQuickFill {...props} />));
  act(() => tree.root.findByType(TextInput).props.onSubmitEditing());
  expect(fill).toHaveBeenCalledTimes(1);
});

it('does not parse empty or whitespace-only requests', () => {
  act(() => { tree = create(<ExpenseQuickFill {...props} text="   " />); });
  expect(tree.root.findByProps({ accessibilityLabel: 'Fill with AI' }).props.disabled).toBe(true);
  act(() => tree.root.findByType(TextInput).props.onSubmitEditing());
  expect(fill).not.toHaveBeenCalled();
});

it('scans a receipt in one tap, but not while recording or busy', () => {
  const scanButton = () => tree.root.findByProps({ accessibilityLabel: 'Snap a receipt to fill' });
  act(() => { tree = create(<ExpenseQuickFill {...props} text="" />); });
  act(() => scanButton().props.onPress());
  expect(scan).toHaveBeenCalledTimes(1);
  act(() => tree.update(<ExpenseQuickFill {...props} text="" busy />));
  expect(scanButton().props.disabled).toBe(true);
  mockVoiceActive = true;
  act(() => tree.update(<ExpenseQuickFill {...props} text="" />));
  expect(scanButton().props.disabled).toBe(true);
});
