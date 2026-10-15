import type { TripPoll } from '@/domain/models';
import { getSupabaseClient } from '@/lib/supabase';

export async function listTripPolls(tripId: string): Promise<TripPoll[]> {
  const { data, error } = await getSupabaseClient()
    .from('trip_polls')
    .select('*, trip_poll_options!trip_poll_options_poll_id_fkey(id, label, position), trip_poll_votes(user_id, option_id)')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map((poll) => ({
    id: poll.id,
    tripId: poll.trip_id,
    createdBy: poll.created_by,
    question: poll.question,
    options: [...poll.trip_poll_options].sort((left, right) => left.position - right.position).map(({ id, label }) => ({ id, label })),
    votes: poll.trip_poll_votes.map((vote) => ({ userId: vote.user_id, optionId: vote.option_id })),
    closesAt: poll.closes_at ?? undefined,
    selectedOptionId: poll.selected_option_id ?? undefined,
    createdAt: poll.created_at,
  }));
}

export async function createTripPoll(input: { tripId: string; question: string; options: string[]; closesAt?: string }) {
  const { error } = await getSupabaseClient().rpc('create_trip_poll', {
    requested_trip_id: input.tripId,
    poll_question: input.question,
    option_labels: input.options,
    ...(input.closesAt ? { poll_closes_at: input.closesAt } : {}),
  });
  if (error) throw error;
}

export async function voteTripPoll(pollId: string, optionId: string) {
  const { error } = await getSupabaseClient().rpc('vote_trip_poll', { requested_poll_id: pollId, requested_option_id: optionId });
  if (error) throw error;
}

export async function closeTripPoll(pollId: string, optionId: string) {
  const { error } = await getSupabaseClient().rpc('close_trip_poll', { requested_poll_id: pollId, requested_option_id: optionId });
  if (error) throw error;
}

export async function deleteTripPoll(pollId: string) {
  const { error } = await getSupabaseClient().rpc('delete_trip_poll', { requested_poll_id: pollId });
  if (error) throw error;
}
