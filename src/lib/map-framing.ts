/**
 * Framing the destination map.
 *
 * The world outline is 1010×666 and a phone screen is portrait, so a viewport
 * that shows the whole world can only ever be a letterbox strip. A map app
 * frames the content instead: the opening view is the trip's own bounding box,
 * not the planet. These helpers do that arithmetic so the component holds only
 * gestures and drawing, and so the numbers can be tested without a renderer.
 *
 * Coordinates are the projection's own 0–1010 / 0–666 space. `contentFit`
 * returns the letterboxed box that space is drawn into; every other function
 * works in the pixels of that box.
 */

export interface Box {
  width: number;
  height: number;
}

export interface MapPoint {
  x: number;
  y: number;
}

export interface MapTransform {
  scale: number;
  translateX: number;
  translateY: number;
}

export const MAP_WIDTH = 1010;
export const MAP_HEIGHT = 666;

/** The largest box with the map's aspect ratio that fits inside `viewport`. */
export function contentFit(viewport: Box): Box {
  if (viewport.width <= 0 || viewport.height <= 0) return { width: 0, height: 0 };
  const scale = Math.min(viewport.width / MAP_WIDTH, viewport.height / MAP_HEIGHT);
  return { width: MAP_WIDTH * scale, height: MAP_HEIGHT * scale };
}

/**
 * Opening transform: the tightest view that still holds every destination,
 * with room around them. A trip in one city would otherwise ask for infinite
 * magnification, so a lone point is framed as if it were `minSpan` across.
 */
export function frameDestinations(
  points: readonly MapPoint[],
  viewport: Box,
  content: Box,
  { padding = 0.78, maxScale = 24, minSpan = 28 }: { padding?: number; maxScale?: number; minSpan?: number } = {},
): MapTransform {
  const still = { scale: 1, translateX: 0, translateY: 0 };
  if (points.length === 0 || content.width <= 0 || content.height <= 0) return still;

  const xs = points.map(({ x }) => (x / MAP_WIDTH) * content.width);
  const ys = points.map(({ y }) => (y / MAP_HEIGHT) * content.height);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);

  const span = {
    width: Math.max(right - left, minSpan),
    height: Math.max(bottom - top, minSpan),
  };
  const scale = clamp(
    Math.min((viewport.width * padding) / span.width, (viewport.height * padding) / span.height),
    1,
    maxScale,
  );

  // Transforms apply as translate-then-scale about the box's own centre, so a
  // point lands centred when the translation cancels its offset from that
  // centre, already magnified.
  const centre = { x: (left + right) / 2, y: (top + bottom) / 2 };
  return clampToBounds(
    { scale, translateX: -scale * (centre.x - content.width / 2), translateY: -scale * (centre.y - content.height / 2) },
    viewport,
    content,
  );
}

/** How far the map may be dragged before its own edge would come into view. */
export function panBounds(viewport: Box, content: Box, scale: number) {
  return {
    x: Math.max(0, (content.width * scale - viewport.width) / 2),
    y: Math.max(0, (content.height * scale - viewport.height) / 2),
  };
}

export function clampToBounds(transform: MapTransform, viewport: Box, content: Box): MapTransform {
  const bounds = panBounds(viewport, content, transform.scale);
  return {
    scale: transform.scale,
    translateX: clamp(transform.translateX, -bounds.x, bounds.x),
    translateY: clamp(transform.translateY, -bounds.y, bounds.y),
  };
}

function clamp(value: number, low: number, high: number) {
  return Math.max(low, Math.min(high, value));
}
