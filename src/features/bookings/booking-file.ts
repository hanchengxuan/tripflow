import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { bookingMimeTypes, decodeBookingFile, maxBookingBytes, type BookingMimeType } from '../../../supabase/functions/parse-booking/contract';

export interface BookingFile {
  name: string;
  base64: string;
  mimeType: BookingMimeType;
  fingerprint: string;
}

export async function pickBookingFile(): Promise<BookingFile | undefined> {
  const result = await DocumentPicker.getDocumentAsync({ type: [...bookingMimeTypes], multiple: false, copyToCacheDirectory: true, base64: true });
  if (result.canceled) return;
  const asset = result.assets[0];
  let base64: string;
  if (Platform.OS === 'web') {
    if (asset.size !== undefined && asset.size > maxBookingBytes) throw new Error('Choose a file smaller than 5 MB.');
    if (!asset.base64) throw new Error('Could not read this file.');
    base64 = asset.base64.replace(/^data:[^,]+,/, '');
  } else {
    const file = new File(asset.uri);
    try {
      if ((asset.size !== undefined && asset.size > maxBookingBytes) || file.size > maxBookingBytes) throw new Error('Choose a file smaller than 5 MB.');
      base64 = await file.base64();
    } finally {
      if (file.uri.startsWith(Paths.cache.uri) && file.exists) file.delete();
    }
  }
  const extensionTypes: Record<string, BookingMimeType> = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  const extension = asset.name.toLowerCase().split('.').pop() ?? '';
  const mimeType = bookingMimeTypes.some((type) => type === asset.mimeType) ? asset.mimeType : extensionTypes[extension];
  const decoded = decodeBookingFile(base64, mimeType);
  const fingerprint = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, base64);
  return { name: asset.name.slice(0, 180), base64, mimeType: decoded.mimeType, fingerprint };
}
