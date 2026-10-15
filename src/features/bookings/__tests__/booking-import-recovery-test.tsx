import { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { importBookingFile, listBookingDocuments, parseBookingFile } from '@/data/booking-repository';
import { pickBookingFile } from '@/features/bookings/booking-file';
import { useBookingImport } from '@/features/bookings/use-booking-import';

jest.mock('@/data/booking-repository', () => ({ importBookingFile: jest.fn(), listBookingDocuments: jest.fn(), parseBookingFile: jest.fn() }));
jest.mock('@/features/bookings/booking-file', () => ({ pickBookingFile: jest.fn() }));
const parse = jest.mocked(parseBookingFile);
const save = jest.mocked(importBookingFile);
const pick = jest.mocked(pickBookingFile);
const trip = { id: 'trip', createdBy: 'owner', name: 'Demo', startsOn: '2026-10-20', endsOn: '2026-10-25', homeCurrency: 'JPY', defaultTimeZone: 'Asia/Tokyo' };
const draft = { kind: 'hotel' as const, title: 'Demo hotel', location: 'Tokyo', startLocal: '2026-10-21 15:00', endLocal: '2026-10-24 11:00', startTimeZone: 'Asia/Tokyo', endTimeZone: 'Asia/Tokyo', flightNumber: '', departureAirport: '', arrivalAirport: '', warnings: [] };
const tx = (_zh: string, en: string) => en;
let tree: ReactTestRenderer;
let flow: ReturnType<typeof useBookingImport>;
function Harness() {
  const current = useBookingImport(trip, 'owner', 'en', tx);
  useEffect(() => { flow = current; });
  return null;
}
function pending<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}
async function setup() {
  await act(async () => { tree = create(<Harness />); });
  await act(async () => { await flow.chooseFile(); });
}
beforeEach(() => {
  jest.clearAllMocks(); parse.mockReset(); save.mockReset();
  jest.mocked(listBookingDocuments).mockResolvedValue([]);
  pick.mockResolvedValue({ name: 'synthetic.pdf', base64: 'synthetic', mimeType: 'application/pdf', fingerprint: 'a'.repeat(64) });
});
afterEach(() => act(() => tree.unmount()));

it('aborts waiting, ignores a late result, and keeps a newer recognition busy', async () => {
  const old = pending<typeof draft[]>(); const next = pending<typeof draft[]>();
  parse.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
  await setup();
  let oldWork!: Promise<void>; let nextWork!: Promise<void>;
  act(() => { oldWork = flow.recognize(); });
  const oldSignal = parse.mock.calls[0][3];
  act(() => flow.cancelRecognition());
  expect(oldSignal?.aborted).toBe(true); expect(flow.busy).toBeUndefined();
  act(() => { nextWork = flow.recognize(); });
  await act(async () => { old.resolve([{ ...draft, title: 'Stale hotel' }]); await oldWork; });
  expect(flow.busy).toBe('recognizing'); expect(flow.drafts).toEqual([]);
  await act(async () => { next.resolve([draft]); await nextWork; });
  expect(flow.busy).toBeUndefined(); expect(flow.drafts[0].title).toBe('Demo hotel');
  expect(save).not.toHaveBeenCalled();
});
it('serializes recognition and aborts it when the sheet unmounts', async () => {
  const request = pending<typeof draft[]>(); parse.mockReturnValue(request.promise); await setup();
  let work!: Promise<void>;
  act(() => { work = flow.recognize(); void flow.recognize(); });
  expect(parse).toHaveBeenCalledTimes(1);
  const signal = parse.mock.calls[0][3]; act(() => tree.unmount());
  expect(signal?.aborted).toBe(true);
  await act(async () => { request.resolve([draft]); await work; });
});
it('reports the exact invalid row before uploading, then permits correction', async () => {
  parse.mockResolvedValue([{ ...draft, startLocal: '' }]); await setup();
  await act(async () => { await flow.recognize(); });
  await act(async () => { await flow.save(); });
  expect(flow.issues[0]).toMatch(/^Check-in time:/); expect(save).not.toHaveBeenCalled();
  act(() => flow.update(0, { startLocal: draft.startLocal }));
  expect(flow.issues[0]).toBeUndefined();
  save.mockResolvedValue({ added: 1, skipped: 0, alreadyImported: false });
  await act(async () => { await flow.save(); });
  expect(save).toHaveBeenCalledTimes(1);
});
it('keeps preview after a failed save and retries without allowing cancellation mid-commit', async () => {
  parse.mockResolvedValue([draft]); await setup();
  await act(async () => { await flow.recognize(); });
  save.mockRejectedValueOnce(new Error('private upstream details'));
  await act(async () => { await flow.save(); });
  expect(flow.error).toMatch(/preview is kept/); expect(flow.error).not.toContain('private upstream');
  expect(flow.drafts).toEqual([draft]);
  const retry = pending<{ added: number; skipped: number; alreadyImported: boolean }>(); save.mockReturnValueOnce(retry.promise);
  let work!: ReturnType<typeof flow.save>;
  act(() => { work = flow.save(); flow.cancelRecognition(); void flow.save(); });
  expect(flow.busy).toBe('saving'); expect(save).toHaveBeenCalledTimes(2);
  expect(save.mock.calls[0]).toEqual(save.mock.calls[1]);
  await act(async () => { retry.resolve({ added: 0, skipped: 0, alreadyImported: true }); await work; });
  expect(flow.busy).toBeUndefined(); expect(flow.error).toBeUndefined();
});
