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

/** Returns a small square image; PNG/WebP sources stay PNG so transparency is not filled black. */
export async function shrinkAvatar(uri: string, mimeType?: string | null) {
  const transparent = mimeType === 'image/png' || mimeType === 'image/webp';
  const original = await ImageManipulator.manipulate(uri).renderAsync();
  const { crop, size } = avatarCrop(original.width, original.height);
  const image = await ImageManipulator.manipulate(original).crop(crop).resize({ width: size, height: size }).renderAsync();
  const saved = await image.saveAsync(transparent ? { format: SaveFormat.PNG } : { format: SaveFormat.JPEG, compress: 0.8 });
  return transparent
    ? { uri: saved.uri, mimeType: 'image/png', extension: 'png' }
    : { uri: saved.uri, mimeType: 'image/jpeg', extension: 'jpg' };
}
