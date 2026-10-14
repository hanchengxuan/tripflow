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
const props = { text: 'Dinner 860 HKD', onChangeText: jest.fn(), onFill: fill, onAudioReady: jest.fn(), busy: false, tx: (_zh: string, en: string) => en };

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
