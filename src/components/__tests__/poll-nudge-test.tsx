import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { PollNudge } from '@/components/poll-nudge';
import type { TripPoll } from '@/domain/models';

jest.mock('@/global.css', () => ({}));
jest.mock('@/features/i18n/i18n-provider', () => ({ useI18n: () => ({ tx: (_zh: string, en: string) => en }) }));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
let mockPolls: TripPoll[] = [];
jest.mock('@/features/polls/use-trip-polls', () => ({ useTripPolls: () => ({ polls: mockPolls }) }));

const poll: TripPoll = {
  id: 'p', tripId: 't', createdBy: 'a', question: 'Dinner?', createdAt: '2026-10-15T00:00:00Z',
  options: [{ id: 'ramen', label: 'Ramen' }], votes: [],
};
let tree: ReactTestRenderer;
const render = () => act(() => { tree = create(<PollNudge tripId="t" currentUserId="me" />); });
afterEach(() => { act(() => tree.unmount()); mockPush.mockReset(); });

it('points to the Trips tab when an open poll still needs my vote', () => {
  mockPolls = [poll];
  render();
  const link = tree.root.findByProps({ accessibilityRole: 'link' });
  expect(link.props.accessibilityLabel).toBe('Your vote is needed: Dinner?. Vote now');
  act(() => link.props.onPress());
  expect(mockPush).toHaveBeenCalledWith('/explore');
});

it('stays quiet once I voted or the poll is decided', () => {
  mockPolls = [{ ...poll, votes: [{ userId: 'me', optionId: 'ramen' }] }, { ...poll, id: 'q', selectedOptionId: 'ramen' }];
  render();
  expect(tree.toJSON()).toBeNull();
});
