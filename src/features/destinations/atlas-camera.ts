export const MAP_WIDTH = 1010;
export const MAP_HEIGHT = 666;
const ASPECT = MAP_HEIGHT / MAP_WIDTH;
/** The narrowest view, about 7° of longitude; the outline data has no finer detail. */
export const MIN_CAMERA_WIDTH = 20;
/** A single-city trip opens on its region (about 28° wide) rather than one dot. */
const MIN_FIT_WIDTH = 80;

/** The visible map region in map units; its height always follows the map's aspect ratio. */
export interface AtlasCamera {
  x: number;
  y: number;
  width: number;
}

export const WORLD_CAMERA: AtlasCamera = { x: 0, y: 0, width: MAP_WIDTH };

export function cameraHeight(camera: AtlasCamera) {
  return camera.width * ASPECT;
}

export function clampCamera({ x, y, width }: AtlasCamera): AtlasCamera {
  const nextWidth = Math.max(MIN_CAMERA_WIDTH, Math.min(MAP_WIDTH, width));
  const height = nextWidth * ASPECT;
  return {
    x: Math.max(0, Math.min(MAP_WIDTH - nextWidth, x)),
    y: Math.max(0, Math.min(MAP_HEIGHT - height, y)),
    width: nextWidth,
  };
}

export function fitCamera(points: { x: number; y: number }[]): AtlasCamera {
  if (points.length === 0) return WORLD_CAMERA;
  const xs = points.map(({ x }) => x);
  const ys = points.map(({ y }) => y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const width = Math.max(MIN_FIT_WIDTH, (maxX - minX) * 1.5, ((maxY - minY) * 1.5) / ASPECT);
  return clampCamera({ x: (minX + maxX) / 2 - width / 2, y: (minY + maxY) / 2 - (width * ASPECT) / 2, width });
}

/** Zooms around the view's centre; a factor above 1 zooms in. */
export function zoomCamera(camera: AtlasCamera, factor: number): AtlasCamera {
  const width = Math.max(MIN_CAMERA_WIDTH, Math.min(MAP_WIDTH, camera.width / factor));
  const centerX = camera.x + camera.width / 2;
  const centerY = camera.y + cameraHeight(camera) / 2;
  return clampCamera({ x: centerX - width / 2, y: centerY - (width * ASPECT) / 2, width });
}

/** Where a map point sits in the view, as fractions of its size; outside 0–1 is off screen. */
export function pointInView(camera: AtlasCamera, point: { x: number; y: number }) {
  return { left: (point.x - camera.x) / camera.width, top: (point.y - camera.y) / cameraHeight(camera) };
}
