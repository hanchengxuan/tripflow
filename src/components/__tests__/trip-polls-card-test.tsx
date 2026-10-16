import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { AvatarStack } from '@/components/avatar-stack';
import { ActionButton } from '@/components/form-controls';
import { TripPollsCard } from '@/components/trip-polls-card';
import type { TripPoll } from '@/domain/models';

jest.mock('@/global.css', () => ({}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/features/i18n/i18n-provider', () => ({ useI18n: () => ({ locale: 'en', languageTag: 'en-US', tx: (_zh: string, en: string) => en }) }));

const mockVote = jest.fn(async () => {});
let mockPolls: TripPoll[] = [];
jest.mock('@/features/polls/use-trip-polls', () => ({
  useTripPolls: () => ({ polls: mockPolls, refreshing: false, reload: jest.fn(), create: jest.fn(), vote: mockVote, decide: jest.fn(), remove: jest.fn() }),
}));

const trip = { id: 'trip', defaultTimeZone: 'Asia/Tokyo' };
const mockMembers = [
  { tripId: 'trip', userId: 'me', displayName: 'Me', role: 'owner' as const },
  { tripId: 'trip', userId: 'sam', displayName: 'Sam', role: 'editor' as const },
];
const open: TripPoll = {
  id: 'open', tripId: 'trip', createdBy: 'owner', question: 'Dinner?', createdAt: '2026-10-15T00:00:00Z',
  options: [{ id: 'ramen', label: 'Ramen' }, { id: 'sushi', label: 'Sushi' }], votes: [],
};
const decided: TripPoll = {
  ...open, id: 'decided', question: 'Lunch?', selectedOptionId: 'udon',
  options: [{ id: 'udon', label: 'Udon' }, { id: 'curry', label: 'Curry' }],
};

let tree: ReactTestRenderer;
const render = (role: 'owner' | 'viewer', userId = 'me') => act(() => { tree = create(<TripPollsCard trip={trip} currentUserId={userId} role={role} members={mockMembers} />); });
const pressables = () => tree.root.findAll((node) => typeof node.type !== 'string' && typeof node.props.onPress === 'function');
const optionRows = () => [...new Map(pressables()
  .filter((node) => /votes?/.test(node.props.accessibilityLabel ?? ''))
  .map((node) => [node.props.accessibilityLabel, node])).values()];
const hasText = (text: string) => tree.root.findAll((node) => node.props.children === text).length > 0;

beforeEach(() => { jest.clearAllMocks(); mockPolls = [open, decided]; });
afterEach(() => act(() => tree.unmount()));

it('lets any traveller vote on an open poll in one tap', async () => {
  render('viewer');
  const rows = optionRows();
  expect(rows).toHaveLength(4);
  const sushi = rows[1];
  expect(sushi.props.accessibilityLabel).toBe('Sushi, 0 votes');
  await act(async () => sushi?.props.onPress());
  expect(mockVote).toHaveBeenCalledWith('open', 'sushi');
});

it('locks the options of a decided poll', () => {
  render('owner');
  const rows = optionRows();
  expect(rows).toHaveLength(4);
  expect(rows.slice(0, 2).map((row) => row.props.disabled)).toEqual([false, false]);
  expect(rows.slice(2).map((row) => row.props.disabled)).toEqual([true, true]);
});

it('shows start and decide controls to editors only', () => {
  render('viewer');
  expect(tree.root.findAllByType(ActionButton)).toHaveLength(0);
  expect(hasText('Pick the result')).toBe(false);
  act(() => tree.unmount());
  render('owner');
  expect(tree.root.findAllByType(ActionButton).map((button) => button.props.children)).toContain('Start a poll');
  expect(hasText('Pick the result')).toBe(true);
});

it('stays hidden for a viewer when the trip has no polls', () => {
  mockPolls = [];
  render('viewer');
  expect(tree.toJSON()).toBeNull();
});

it('names who voted for each option and stacks their avatars', () => {
  mockPolls = [{ ...open, votes: [{ userId: 'me', optionId: 'sushi' }, { userId: 'sam', optionId: 'sushi' }] }];
  render('viewer');
  expect(optionRows()[1].props.accessibilityLabel).toBe('Sushi, 2 votes: Me, Sam, your vote');
  expect(tree.root.findAllByType(AvatarStack).map((stack) => stack.props.people.length)).toEqual([0, 2]);
});

it('draws each option as a share of the votes', () => {
  mockPolls = [{ ...open, votes: [{ userId: 'me', optionId: 'ramen' }, { userId: 'sam', optionId: 'ramen' }, { userId: 'x', optionId: 'sushi' }] } as TripPoll];
  render('viewer');
  const fills = tree.root.findAll((node) => typeof node.type === 'string' && typeof node.props.style === 'object' && JSON.stringify(node.props.style).includes('"width":"'))
    .map((node) => JSON.stringify(node.props.style).match(/"width":"(\d+)%"/)?.[1]);
  expect(fills).toEqual(['67', '33']);
});
