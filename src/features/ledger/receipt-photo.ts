import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import type { ReceiptDraft } from '@/components/expense-composer';

export type ReceiptPhotoResult =
  | { status: 'ok'; receipt: ReceiptDraft & { base64: string } }
  | { status: 'canceled' | 'permission-denied' | 'too-large' };

/** Takes or picks a receipt photo and normalizes it to a JPEG at most 2000px wide. */
export async function captureReceiptPhoto(source: 'camera' | 'library'): Promise<ReceiptPhotoResult> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { status: 'permission-denied' };
  }
  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
  if (result.canceled) return { status: 'canceled' };
  const asset = result.assets[0];
  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width > 2000) context.resize({ width: 2000, height: null });
  const rendered = await context.renderAsync();
  const normalized = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.75, base64: true });
  if (!normalized.base64 || Math.ceil(normalized.base64.length * 0.75) > 10 * 1024 * 1024) return { status: 'too-large' };
  return { status: 'ok', receipt: { uri: normalized.uri, base64: normalized.base64, mimeType: 'image/jpeg' } };
}
