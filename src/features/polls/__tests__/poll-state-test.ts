import type { TripPoll } from '@/domain/models';
import { cleanPollDraft, pollStatus, tallyPoll } from '@/features/polls/poll-state';

const poll: TripPoll = {
  id: 'poll', tripId: 'trip', createdBy: 'a', question: '晚饭吃什么？', createdAt: '2026-10-15T00:00:00Z',
  options: [{ id: 'ramen', label: '拉面' }, { id: 'sushi', label: '寿司' }, { id: 'bbq', label: '烤肉' }],
  votes: [{ userId: 'a', optionId: 'sushi' }, { userId: 'b', optionId: 'sushi' }, { userId: 'c', optionId: 'ramen' }],
};
const now = new Date('2026-10-15T12:00:00Z');

test('a poll without a decision or a passed deadline is open', () => {
  expect(pollStatus(poll, now)).toBe('open');
  expect(pollStatus({ ...poll, closesAt: '2026-10-15T13:00:00Z' }, now)).toBe('open');
});

test('a passed deadline stops voting until someone decides', () => {
  expect(pollStatus({ ...poll, closesAt: '2026-10-15T12:00:00Z' }, now)).toBe('expired');
});

test('a decided poll stays decided even after its deadline', () => {
  expect(pollStatus({ ...poll, selectedOptionId: 'sushi', closesAt: '2026-10-15T11:00:00Z' }, now)).toBe('decided');
});

test('the tally counts votes per option in display order and finds the leader', () => {
  const tally = tallyPoll(poll, 'c');
  expect(tally.options.map(({ id, count }) => [id, count])).toEqual([['ramen', 1], ['sushi', 2], ['bbq', 0]]);
  expect(tally.total).toBe(3);
  expect(tally.leaderIds).toEqual(['sushi']);
  expect(tally.myOptionId).toBe('ramen');
});

test('a tie reports every leading option and no votes reports no leader', () => {
  const tied = tallyPoll({ ...poll, votes: [{ userId: 'a', optionId: 'sushi' }, { userId: 'b', optionId: 'ramen' }] }, 'z');
  expect(tied.leaderIds).toEqual(['ramen', 'sushi']);
  expect(tied.myOptionId).toBeUndefined();
  expect(tallyPoll({ ...poll, votes: [] }, 'a').leaderIds).toEqual([]);
});

describe('cleanPollDraft', () => {
  const tx = (_zh: string, en: string) => en;

  test('trims the question and options and drops blank option rows', () => {
    expect(cleanPollDraft({ question: '  Dinner? ', options: [' Ramen ', '', 'Sushi', '  '] }, tx)).toEqual({ question: 'Dinner?', options: ['Ramen', 'Sushi'] });
  });

  test('matches the server rules with a readable message', () => {
    expect(cleanPollDraft({ question: ' ', options: ['A', 'B'] }, tx)).toEqual({ error: 'Enter a question.' });
    expect(cleanPollDraft({ question: 'Q', options: ['A', ''] }, tx)).toEqual({ error: 'Add at least 2 options.' });
    expect(cleanPollDraft({ question: 'Q', options: ['Ramen', 'ramen '] }, tx)).toEqual({ error: 'Each option must be different.' });
    expect(cleanPollDraft({ question: 'Q'.repeat(161), options: ['A', 'B'] }, tx)).toEqual({ error: 'Keep the question under 160 characters.' });
    expect(cleanPollDraft({ question: 'Q', options: ['A', 'B'.repeat(121)] }, tx)).toEqual({ error: 'Keep each option under 120 characters.' });
  });
});
