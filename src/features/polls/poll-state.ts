import type { TripPoll, TripRole, UserId } from '@/domain/models';

export type PollStatus = 'open' | 'expired' | 'decided';

export function pollStatus(poll: TripPoll, now: Date): PollStatus {
  if (poll.selectedOptionId) return 'decided';
  if (poll.closesAt && new Date(poll.closesAt).getTime() <= now.getTime()) return 'expired';
  return 'open';
}

export function canManagePoll(poll: TripPoll, currentUserId: UserId, role?: TripRole) {
  return role === 'owner' || role === 'editor' || poll.createdBy === currentUserId;
}

export function tallyPoll(poll: TripPoll, currentUserId: UserId) {
  const options = poll.options.map((option) => ({ ...option, count: poll.votes.filter((vote) => vote.optionId === option.id).length }));
  const top = Math.max(0, ...options.map(({ count }) => count));
  return {
    options,
    total: poll.votes.length,
    leaderIds: top === 0 ? [] : options.filter(({ count }) => count === top).map(({ id }) => id),
    myOptionId: poll.votes.find((vote) => vote.userId === currentUserId)?.optionId,
  };
}

// Votes move freely while a poll is open; tapping your own choice takes it back. Expired and decided polls are a fixed record.
export function pollVoteAction(poll: TripPoll, currentUserId: UserId, optionId: string, now: Date): 'vote' | 'withdraw' | undefined {
  if (pollStatus(poll, now) !== 'open') return undefined;
  return tallyPoll(poll, currentUserId).myOptionId === optionId ? 'withdraw' : 'vote';
}

export const maxPollOptions = 6;

export function cleanPollDraft(draft: { question: string; options: string[] }, tx: (zh: string, en: string) => string): { question: string; options: string[] } | { error: string } {
  const question = draft.question.trim();
  const options = draft.options.map((option) => option.trim()).filter(Boolean);
  if (!question) return { error: tx('请输入问题。', 'Enter a question.') };
  if (question.length > 160) return { error: tx('问题请控制在 160 字以内。', 'Keep the question under 160 characters.') };
  if (options.length < 2) return { error: tx('至少需要 2 个选项。', 'Add at least 2 options.') };
  if (options.some((option) => option.length > 120)) return { error: tx('每个选项请控制在 120 字以内。', 'Keep each option under 120 characters.') };
  if (new Set(options.map((option) => option.toLowerCase())).size !== options.length) return { error: tx('选项不能重复。', 'Each option must be different.') };
  return { question, options: options.slice(0, maxPollOptions) };
}
