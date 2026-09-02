import { clampToBounds, contentFit, frameDestinations, MAP_HEIGHT, MAP_WIDTH, panBounds } from '@/lib/map-framing';

// A phone-shaped map viewport: taller than the 1010:666 world outline.
const viewport = { width: 350, height: 560 };

describe('contentFit', () => {
  it('letterboxes a landscape map inside a portrait viewport', () => {
    const content = contentFit(viewport);
    expect(content.width).toBe(350);
    expect(Math.round(content.height)).toBe(231);
  });

  it('pillarboxes when the viewport is wider than the map', () => {
    const content = contentFit({ width: 2000, height: 400 });
    expect(Math.round(content.height)).toBe(400);
    expect(Math.round(content.width)).toBe(Math.round((MAP_WIDTH / MAP_HEIGHT) * 400));
  });

  it('returns nothing for a viewport that has not been laid out yet', () => {
    expect(contentFit({ width: 0, height: 0 })).toEqual({ width: 0, height: 0 });
  });
});

describe('frameDestinations', () => {
  const content = contentFit(viewport);

  it('stays still when there is nothing to frame', () => {
    expect(frameDestinations([], viewport, content)).toEqual({ scale: 1, translateX: 0, translateY: 0 });
  });

  it('magnifies a trip that occupies a small part of the world', () => {
    // Two points about 20px apart in the 1010-wide projection — one city pair.
    const framed = frameDestinations([{ x: 700, y: 260 }, { x: 720, y: 275 }], viewport, content);
    expect(framed.scale).toBeGreaterThan(1);
  });

  it('never magnifies past maxScale, however tight the destinations are', () => {
    const framed = frameDestinations([{ x: 700, y: 260 }], viewport, content, { maxScale: 4 });
    expect(framed.scale).toBeLessThanOrEqual(4);
  });

  it('never shrinks below 1, however spread out the destinations are', () => {
    const framed = frameDestinations([{ x: 0, y: 0 }, { x: MAP_WIDTH, y: MAP_HEIGHT }], viewport, content);
    expect(framed.scale).toBe(1);
  });

  it('keeps the framing inside the map, never showing past its edge', () => {
    const framed = frameDestinations([{ x: 1000, y: 640 }], viewport, content);
    const bounds = panBounds(viewport, content, framed.scale);
    expect(Math.abs(framed.translateX)).toBeLessThanOrEqual(bounds.x + 0.001);
    expect(Math.abs(framed.translateY)).toBeLessThanOrEqual(bounds.y + 0.001);
  });

  it('centres a pair of destinations between them', () => {
    const left = { x: 400, y: 333 };
    const right = { x: 600, y: 333 };
    const framed = frameDestinations([left, right], viewport, content);
    const midpoint = frameDestinations([{ x: 500, y: 333 }], viewport, content, { maxScale: framed.scale });
    expect(framed.translateX).toBeCloseTo(midpoint.translateX, 5);
  });
});

describe('panBounds', () => {
  it('allows no movement while the map is smaller than its viewport', () => {
    expect(panBounds(viewport, contentFit(viewport), 1)).toEqual({ x: 0, y: 0 });
  });

  it('allows movement on the axis the magnified map overflows', () => {
    const bounds = panBounds(viewport, contentFit(viewport), 3);
    expect(bounds.x).toBeCloseTo((350 * 3 - 350) / 2, 5);
    expect(bounds.y).toBeGreaterThan(0);
  });
});

describe('clampToBounds', () => {
  it('pulls an over-dragged transform back to the edge', () => {
    const content = contentFit(viewport);
    const clamped = clampToBounds({ scale: 2, translateX: 9999, translateY: -9999 }, viewport, content);
    const bounds = panBounds(viewport, content, 2);
    expect(clamped.translateX).toBe(bounds.x);
    expect(clamped.translateY).toBe(-bounds.y);
  });
});
