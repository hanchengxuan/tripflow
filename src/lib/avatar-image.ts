import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** Avatars render at most ~48pt, so 256px covers 3× screens with room to spare. */
export const AVATAR_PIXELS = 256;

/** Centre square crop, scaled down to AVATAR_PIXELS when larger. */
export function avatarCrop(width: number, height: number) {
  const side = Math.min(width, height);
  return {
    crop: { originX: Math.floor((width - side) / 2), originY: Math.floor((height - side) / 2), width: side, height: side },
    size: Math.min(side, AVATAR_PIXELS),
  };
}

/** Returns a small square JPEG so every avatar download stays a few kilobytes. */
export async function shrinkAvatar(uri: string) {
  const original = await ImageManipulator.manipulate(uri).renderAsync();
  const { crop, size } = avatarCrop(original.width, original.height);
  const image = await ImageManipulator.manipulate(original).crop(crop).resize({ width: size, height: size }).renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  return saved.uri;
}
