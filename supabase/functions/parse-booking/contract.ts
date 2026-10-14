export const bookingMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
export type BookingMimeType = typeof bookingMimeTypes[number];
export const maxBookingBytes = 5 * 1024 * 1024;

export interface BookingDraft {
  kind: 'flight' | 'hotel';
  title: string;
  location: string;
  startLocal: string;
  endLocal: string;
  startTimeZone: string;
  endTimeZone: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  warnings: string[];
}

function text(value: unknown, limit = 180) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

export function sanitizeBookings(value: unknown): BookingDraft[] {
  if (!Array.isArray(value) || value.length > 12) throw new Error('Invalid booking response');
  return value.map((raw) => {
    if (!raw || typeof raw !== 'object') throw new Error('Invalid booking');
    const row = raw as Record<string, unknown>;
    if (row.kind !== 'flight' && row.kind !== 'hotel') throw new Error('Unsupported booking type');
    return {
      kind: row.kind,
      title: text(row.title),
      location: text(row.location, 500),
      startLocal: text(row.startLocal, 16),
      endLocal: text(row.endLocal, 16),
      startTimeZone: text(row.startTimeZone, 80),
      endTimeZone: text(row.endTimeZone, 80),
      flightNumber: text(row.flightNumber, 20),
      departureAirport: text(row.departureAirport, 120),
      arrivalAirport: text(row.arrivalAirport, 120),
      warnings: Array.isArray(row.warnings) ? row.warnings.filter((entry): entry is string => typeof entry === 'string').slice(0, 4).map((entry) => text(entry, 240)) : [],
    };
  });
}

export function decodeBookingFile(base64: unknown, mimeType: unknown) {
  if (typeof base64 !== 'string' || base64.length > Math.ceil(maxBookingBytes / 3) * 4 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new Error('Invalid file data');
  if (!bookingMimeTypes.some((mime) => mime === mimeType)) throw new Error('Unsupported file type');
  const binary = atob(base64);
  if (!binary.length || binary.length > maxBookingBytes) throw new Error('File exceeds 5 MB');
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const signature = Array.from(bytes.slice(0, 12));
  const matches = mimeType === 'application/pdf' ? binary.startsWith('%PDF-')
    : mimeType === 'image/jpeg' ? signature[0] === 255 && signature[1] === 216 && signature[2] === 255
    : mimeType === 'image/png' ? signature.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10'
    : binary.startsWith('RIFF') && binary.slice(8, 12) === 'WEBP';
  if (!matches) throw new Error('File content does not match its type');
  return { bytes, mimeType: mimeType as BookingMimeType };
}
