export function createTripOpener(onPending: (tripId?: string) => void) {
  let focused = false;
  let generation = 0;
  let pending = false;
  return {
    focus() {
      focused = true;
      return () => { focused = false; generation += 1; };
    },
    cancel() { generation += 1; },
    async open(tripId: string, activeId: string | undefined, select: (id: string) => Promise<void>, onOpened: () => void, onError: (error: unknown) => void) {
      if (pending || !focused) return;
      pending = true;
      const request = ++generation;
      onPending(tripId);
      try {
        if (tripId !== activeId) await select(tripId);
        if (focused && request === generation) onOpened();
      } catch (error) {
        if (focused && request === generation) onError(error);
      } finally {
        pending = false;
        onPending(undefined);
      }
    },
  };
}
