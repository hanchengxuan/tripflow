import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useState } from 'react';
import { TextInput } from 'react-native';

import { LocationField } from '@/components/location-field';
import { type PlaceSuggestion, searchPlaces } from '@/features/places/place-search';

jest.mock('@/global.css', () => ({}));
jest.mock('@/features/places/place-search', () => ({ searchPlaces: jest.fn() }));
jest.mock('@/features/i18n/i18n-provider', () => ({ useI18n: () => ({ locale: 'en', tx: (_zh: string, en: string) => en }) }));
const search = jest.mocked(searchPlaces);
const tokyo: PlaceSuggestion = { placeId: 'tokyo', mainText: 'Tokyo', secondaryText: 'Japan', text: 'Tokyo, Japan' };
const osaka: PlaceSuggestion = { ...tokyo, placeId: 'osaka', mainText: 'Osaka', text: 'Osaka, Japan' };
let tree: ReactTestRenderer;
function Harness() {
  const [value, setValue] = useState('Existing hotel');
  return <LocationField value={value} onChange={setValue} onSelect={(place) => setValue(place.text)} />;
}
function mount() { act(() => { tree = create(<Harness />); }); }
function type(value: string) { act(() => tree.root.findByType(TextInput).props.onChangeText(value)); }
async function debounce() { await act(async () => { jest.advanceTimersByTime(450); }); }
function pending() {
  let resolve!: (value: PlaceSuggestion[]) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<PlaceSuggestion[]>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
beforeEach(() => { jest.useFakeTimers(); search.mockReset(); });
afterEach(() => { act(() => tree.unmount()); jest.useRealTimers(); });

it('does not query a prefilled edit and debounces traveller input', async () => {
  search.mockResolvedValue([]); mount(); await debounce(); expect(search).not.toHaveBeenCalled();
  type('Tok'); type('Tokyo'); await debounce();
  expect(search).toHaveBeenCalledTimes(1); expect(search.mock.calls[0][0]).toBe('Tokyo');
});
it('ignores old success after a newer query finishes', async () => {
  const old = pending(); search.mockReturnValueOnce(old.promise).mockResolvedValueOnce([osaka]); mount();
  type('Tokyo'); await debounce(); type('Osaka'); await debounce();
  await act(async () => old.resolve([tokyo]));
  expect(tree.root.findAllByProps({ children: 'Tokyo' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ children: 'Osaka' }).length).toBeGreaterThan(0);
});
it('ignores old failures and clears results when the query is too short', async () => {
  const old = pending(); search.mockReturnValueOnce(old.promise).mockResolvedValueOnce([osaka]); mount();
  type('Tokyo'); await debounce(); type('Osaka'); await debounce();
  await act(async () => old.reject(new Error('old request')));
  expect(tree.root.findAllByProps({ accessibilityLiveRegion: 'polite' })).toHaveLength(0);
  type('Os'); expect(tree.root.findAllByProps({ children: 'Osaka' })).toHaveLength(0);
});
it('keeps manual entry usable and retries after a transient failure', async () => {
  search.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([osaka]); mount();
  type('Tokyo'); await debounce();
  expect(tree.root.findAllByProps({ accessibilityLiveRegion: 'polite' }).length).toBeGreaterThan(0);
  type('Osaka'); await debounce();
  expect(tree.root.findAllByProps({ accessibilityLiveRegion: 'polite' })).toHaveLength(0);
  expect(search).toHaveBeenCalledTimes(2);
});
it('selects a suggestion without querying its filled label again', async () => {
  search.mockResolvedValue([tokyo]); mount(); type('Tokyo'); await debounce();
  act(() => tree.root.findAllByProps({ accessibilityRole: 'button' })[0].props.onPress());
  await debounce(); expect(search).toHaveBeenCalledTimes(1);
  expect(tree.root.findByType(TextInput).props.value).toBe('Tokyo, Japan');
});
