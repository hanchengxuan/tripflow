import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { MemberChip, SplitModePicker } from '@/components/expense-pickers';
import type { TripMember } from '@/domain/models';

jest.mock('@/global.css', () => ({}));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('expo-image', () => ({ Image: () => null }));

const tx = (_zh: string, en: string) => en;
const member = { tripId: 't', userId: 'u1', displayName: 'Mei', role: 'editor' } as TripMember;
let tree: ReactTestRenderer;
/** The outermost pressable for each role; inner host nodes repeat the same props. */
const byRole = (role: string) => tree.root.findAll(({ props }) => props.accessibilityRole === role && typeof props.onPress === 'function', { deep: false });
afterEach(() => act(() => tree.unmount()));

it('names the traveller and reports whether they are ticked', () => {
  const onPress = jest.fn();
  act(() => { tree = create(<MemberChip member={member} selected onPress={onPress} />); });
  const [chip] = byRole('checkbox');
  expect(chip.props.accessibilityLabel).toBe('Mei');
  expect(chip.props.accessibilityState).toEqual({ checked: true });
  act(() => chip.props.onPress());
  expect(onPress).toHaveBeenCalled();
});

it('explains each split rule and reports the one picked', () => {
  const onChange = jest.fn();
  act(() => { tree = create(<SplitModePicker value="equal" onChange={onChange} tx={tx} />); });
  const options = byRole('radio');
  expect(options.map(({ props }) => [props.accessibilityLabel, props.accessibilityState.checked])).toEqual([
    ['Equal, Same for everyone', true],
    ['Exact, Type each amount', false],
    ['Percent, Like 60% / 40%', false],
    ['Shares, Like 2 : 1', false],
  ]);
  act(() => options[2].props.onPress());
  expect(onChange).toHaveBeenCalledWith('percentage');
});
