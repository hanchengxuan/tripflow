import { cameraHeight, fitCamera, MAP_HEIGHT, MAP_WIDTH, MIN_CAMERA_WIDTH, pointInView, WORLD_CAMERA, zoomCamera } from '@/features/destinations/atlas-camera';
import { projectDestination } from '@/features/destinations/destination-search';

const tokyo = projectDestination(35.69, 139.69);
const osaka = projectDestination(34.69, 135.5);

const inside = (camera: ReturnType<typeof fitCamera>, point: { x: number; y: number }) => {
  const { left, top } = pointInView(camera, point);
  return left > 0 && left < 1 && top > 0 && top < 1;
};

it('opens a trip in Japan on Japan instead of the whole world', () => {
  const camera = fitCamera([tokyo, osaka]);
  expect(camera.width).toBeLessThan(MAP_WIDTH / 8);
  expect(inside(camera, tokyo)).toBe(true);
  expect(inside(camera, osaka)).toBe(true);
});

it('shows the world when no destination has a pin', () => {
  expect(fitCamera([])).toEqual(WORLD_CAMERA);
});

it('keeps the view on the map and within the zoom limits', () => {
  const zoomedIn = zoomCamera(fitCamera([tokyo]), 50);
  expect(zoomedIn.width).toBe(MIN_CAMERA_WIDTH);
  expect(inside(zoomedIn, tokyo)).toBe(true);

  const zoomedOut = zoomCamera(fitCamera([tokyo]), 1 / 50);
  expect(zoomedOut).toEqual({ x: 0, y: 0, width: MAP_WIDTH });
  expect(cameraHeight(zoomedOut)).toBe(MAP_HEIGHT);
});
