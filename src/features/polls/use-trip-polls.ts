import { useCallback, useEffect, useState } from 'react';

import { closeTripPoll, createTripPoll, deleteTripPoll, listTripPolls, reopenTripPoll, voteTripPoll, withdrawTripPollVote } from '@/data/poll-repository';
import type { TripPoll } from '@/domain/models';

export function useTripPolls(tripId: string) {
  const [state, setState] = useState<{ tripId: string; polls: TripPoll[] }>();
  const [loadError, setLoadError] = useState<unknown>();
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    setRefreshing(true);
    try {
      setState({ tripId, polls: await listTripPolls(tripId) });
      setLoadError(undefined);
    } catch (caught) {
      setLoadError(caught);
    } finally {
      setRefreshing(false);
    }
  }, [tripId]);

  useEffect(() => {
    const timeout = setTimeout(() => void reload(), 0);
    return () => clearTimeout(timeout);
  }, [reload]);

  const thenReload = useCallback(<Args extends unknown[]>(action: (...args: Args) => Promise<void>) => async (...args: Args) => {
    await action(...args);
    await reload();
  }, [reload]);

  return {
    polls: state?.tripId === tripId ? state.polls : undefined,
    loadError,
    refreshing,
    reload,
    create: thenReload(createTripPoll),
    vote: thenReload(voteTripPoll),
    withdraw: thenReload(withdrawTripPollVote),
    decide: thenReload(closeTripPoll),
    reopen: thenReload(reopenTripPoll),
    remove: thenReload(deleteTripPoll),
  };
}
