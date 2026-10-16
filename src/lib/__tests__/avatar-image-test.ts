import { AVATAR_PIXELS, avatarCrop, shrinkAvatar } from '@/lib/avatar-image';

const mockCalls: { crop?: unknown; resize?: unknown; save?: unknown } = {};

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
  ImageManipulator: {
    manipulate: (source: unknown) => ({
      crop(rect: unknown) { mockCalls.crop = rect; return this; },
      resize(size: unknown) { mockCalls.resize = size; return this; },
      renderAsync: async () => typeof source === 'string'
        ? { width: 3648, height: 2736 }
        : { saveAsync: async (options: unknown) => { mockCalls.save = options; return { uri: 'file://small.jpg' }; } },
    }),
  },
}));

describe('avatarCrop', () => {
  it('centre-crops a landscape photo to a square and scales it down', () => {
    expect(avatarCrop(3648, 2736)).toEqual({
      crop: { originX: 456, originY: 0, width: 2736, height: 2736 },
      size: AVATAR_PIXELS,
    });
  });

  it('centre-crops a portrait photo', () => {
    expect(avatarCrop(1000, 1500).crop).toEqual({ originX: 0, originY: 250, width: 1000, height: 1000 });
  });

  it('never upscales a small image', () => {
    expect(avatarCrop(120, 120)).toEqual({ crop: { originX: 0, originY: 0, width: 120, height: 120 }, size: 120 });
  });
});

describe('shrinkAvatar', () => {
  it('saves a square JPEG no larger than the avatar size', async () => {
    await expect(shrinkAvatar('file://original.jpg', 'image/jpeg')).resolves.toEqual({ uri: 'file://small.jpg', mimeType: 'image/jpeg', extension: 'jpg' });
    expect(mockCalls.crop).toEqual({ originX: 456, originY: 0, width: 2736, height: 2736 });
    expect(mockCalls.resize).toEqual({ width: AVATAR_PIXELS, height: AVATAR_PIXELS });
    expect(mockCalls.save).toEqual({ format: 'jpeg', compress: 0.8 });
  });

  it('keeps PNG and WebP avatars as PNG so transparency survives', async () => {
    await expect(shrinkAvatar('file://logo.webp', 'image/webp')).resolves.toEqual({ uri: 'file://small.jpg', mimeType: 'image/png', extension: 'png' });
    expect(mockCalls.save).toEqual({ format: 'png' });
  });
});
