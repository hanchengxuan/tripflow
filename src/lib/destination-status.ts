/**
 * Where a destination sits relative to now.
 *
 * Kept out of the map component because it is the one part of the atlas that
 * can be tested without a renderer, and because the map pin, the legend and
 * the place panel all have to agree about it.
 */
export type DestinationStatus = 'visited' | 'current' | 'planned';

export interface DestinationSpan {
  startsAt: string;
  endsAt?: string | null;
}

/**
 * `current` wins over `planned`: a place you are standing in is the answer to
 * "where am I", even when later plans there also exist. A place is `visited`
 * only when nothing about it is still ahead.
 */
export function destinationStatus(spans: readonly DestinationSpan[], now: number): DestinationStatus {
  const inside = spans.some((span) => {
    const start = new Date(span.startsAt).getTime();
    const end = new Date(span.endsAt ?? span.startsAt).getTime();
    return start <= now && now <= end;
  });
  if (inside) return 'current';
  if (spans.some((span) => new Date(span.startsAt).getTime() > now)) return 'planned';
  return 'visited';
}
