import { pickBookingFile } from '../booking-file';

const mockPick = jest.fn();
const mockRead = jest.fn();
const mockDelete = jest.fn();
const mockDigest = jest.fn();

jest.mock('expo-document-picker', () => ({ getDocumentAsync: () => mockPick() }));
jest.mock('expo-crypto', () => ({ CryptoDigestAlgorithm: { SHA256: 'SHA-256' }, digestStringAsync: () => mockDigest() }));
jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///cache/' } },
  File: class {
    uri: string;
    exists = true;
    size = 9;
    constructor(uri: string) { this.uri = uri; }
    base64() { return mockRead(); }
    delete() { mockDelete(this.uri); }
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockRead.mockResolvedValue(btoa('%PDF-1.7\n'));
  mockDigest.mockResolvedValue('a'.repeat(64));
});

function pick(uri: string, name = 'reservation.pdf', mimeType?: string, size = 9) {
  mockPick.mockResolvedValue({ canceled: false, assets: [{ uri, name, mimeType, size }] });
}

test('temporary picker copies are removed after reading', async () => {
  pick('file:///cache/reservation.pdf', 'reservation.pdf', 'application/pdf');
  expect((await pickBookingFile())?.mimeType).toBe('application/pdf');
  expect(mockDelete).toHaveBeenCalledWith('file:///cache/reservation.pdf');
});
test('externally owned originals are never removed', async () => {
  pick('file:///documents/reservation.pdf');
  await pickBookingFile();
  expect(mockDelete).not.toHaveBeenCalled();
});
test('provider-omitted image MIME is inferred then verified from its signature', async () => {
  pick('file:///cache/reservation.jpeg', 'reservation.jpeg');
  mockRead.mockResolvedValue(btoa(String.fromCharCode(255, 216, 255) + 'demo'));
  expect((await pickBookingFile())?.mimeType).toBe('image/jpeg');
});
test('oversized native cache copies are removed without reading or hashing', async () => {
  pick('file:///cache/large.pdf', 'large.pdf', 'application/pdf', 6 * 1024 * 1024);
  await expect(pickBookingFile()).rejects.toThrow('5 MB');
  expect(mockRead).not.toHaveBeenCalled();
  expect(mockDigest).not.toHaveBeenCalled();
  expect(mockDelete).toHaveBeenCalledWith('file:///cache/large.pdf');
});
test('cancelling the picker creates no draft or file operation', async () => {
  mockPick.mockResolvedValue({ canceled: true, assets: null });
  expect(await pickBookingFile()).toBeUndefined();
  expect(mockRead).not.toHaveBeenCalled();
  expect(mockDelete).not.toHaveBeenCalled();
});
