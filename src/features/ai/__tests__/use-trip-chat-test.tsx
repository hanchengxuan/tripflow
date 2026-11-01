import { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { sendTripChat, type TripChatReply } from '@/features/ai/trip-chat';
import { useTripChat } from '@/features/ai/use-trip-chat';

jest.mock('@/lib/edge-function', () => ({ invokeEdgeFunction: jest.fn() }));
jest.mock('@/features/ai/trip-chat', () => ({
  ...jest.requireActual('@/features/ai/trip-chat'),
  sendTripChat: jest.fn(),
}));
const mockSend = jest.mocked(sendTripChat);
let chat: ReturnType<typeof useTripChat>;
let tree: ReactTestRenderer;

function Harness() {
  const value = useTripChat({ tripId: 'trip', itineraryItems: [], memberIds: ['me'], locale: 'en', tx: (_zh, en) => en });
  useEffect(() => { chat = value; }, [value]);
  return null;
}

function pendingReply() {
  let resolve: (reply: TripChatReply) => void = () => { throw new Error('Reply is not ready'); };
  let reject: (error: Error) => void = () => { throw new Error('Reply is not ready'); };
  const promise = new Promise<TripChatReply>((onResolve, onReject) => { resolve = onResolve; reject = onReject; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.clearAllMocks();
  act(() => { tree = create(<Harness />); });
});
afterEach(() => act(() => tree.unmount()));

it('sends only once when called twice before rendering busy state', async () => {
  const pending = pendingReply();
  mockSend.mockReturnValueOnce(pending.promise);
  let first: Promise<void> | undefined;
  act(() => { first = chat.send('Next?'); void chat.send('Next?'); });
  expect(mockSend).toHaveBeenCalledTimes(1);
  expect(chat.busy).toBe(true);
  expect(chat.turns).toHaveLength(1);
  await act(async () => { pending.resolve({ answer: 'Lunch', actions: [] }); await first; });
  expect(chat.turns.map(({ text }) => text)).toEqual(['Next?', 'Lunch']);
  expect(chat.busy).toBe(false);
});

it('stops immediately and ignores a late result without clearing the next request', async () => {
  const old = pendingReply();
  const next = pendingReply();
  mockSend.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
  let first: Promise<void> | undefined;
  let second: Promise<void> | undefined;
  act(() => { first = chat.send('First'); });
  const signal = mockSend.mock.calls[0][0].signal;
  act(() => chat.stop());
  expect(signal?.aborted).toBe(true);
  expect(chat.busy).toBe(false);
  act(() => { second = chat.send('Second'); });
  await act(async () => { old.resolve({ answer: 'Late answer', actions: [] }); await first; });
  expect(chat.busy).toBe(true);
  expect(chat.turns.map(({ text }) => text)).toEqual(['First', 'Second']);
  await act(async () => { next.resolve({ answer: 'Current answer', actions: [] }); await second; });
  expect(chat.turns.map(({ text }) => text)).toEqual(['First', 'Second', 'Current answer']);
});

it('aborts on unmount and ignores a late rejection', async () => {
  const pending = pendingReply();
  mockSend.mockReturnValueOnce(pending.promise);
  let sending: Promise<void> | undefined;
  act(() => { sending = chat.send('Next?'); });
  const signal = mockSend.mock.calls[0][0].signal;
  act(() => tree.unmount());
  expect(signal?.aborted).toBe(true);
  await act(async () => { pending.reject(new Error('Late failure')); await sending; });
  expect(chat.error).toBeUndefined();
});

it('restores a photo on stop and retains photo-only history text', async () => {
  const pending = pendingReply();
  mockSend.mockReturnValueOnce(pending.promise);
  const photo = { uri: 'file://receipt.jpg', base64: 'IMG', mimeType: 'image/jpeg' };
  act(() => chat.setPhoto(photo));
  let sending: Promise<void> | undefined;
  act(() => { sending = chat.send(''); });
  expect(mockSend.mock.calls[0][0]).toMatchObject({ image: { base64: 'IMG', mimeType: 'image/jpeg' }, messages: [{ role: 'user', text: 'Take a look at this photo' }] });
  act(() => chat.stop());
  expect(chat.photo).toEqual(photo);
  await act(async () => { pending.resolve({ answer: 'Late answer', actions: [] }); await sending; });
  expect(chat.turns).toHaveLength(1);
});

it('includes saved and opened proposal status in the next message history', async () => {
  mockSend.mockResolvedValueOnce({ answer: 'Review these', actions: [
    { type: 'add_plan', kind: 'food', title: 'Lunch', startLocal: '2026-11-14 12:00', endLocal: '2026-11-14 13:00' },
    { type: 'add_expense', title: 'Taxi', amount: '24', currency: 'USD' },
  ] }).mockResolvedValueOnce({ answer: 'OK', actions: [], run: { status: 'limited', steps: 2, toolCalls: 1 } });
  await act(async () => { await chat.send('Make a plan'); });
  const assistant = chat.turns.find(({ role }) => role === 'assistant');
  if (!assistant) throw new Error('Missing assistant turn');
  act(() => { chat.setStatus(assistant.id, 0, 'saved'); chat.setStatus(assistant.id, 1, 'opened'); });
  await act(async () => { await chat.send('What happened?'); });
  const history = mockSend.mock.calls[1][0].messages;
  expect(history[1].text).toContain('[saved] add_plan Lunch');
  expect(history[1].text).toContain('[opened] add_expense Taxi');
  expect(history[1].text).toContain('opened means a ledger draft, not saved');
  expect(chat.turns.at(-1)?.run?.status).toBe('limited');
});

it('keeps all five proposal statuses ahead of a long answer within the server history limit', async () => {
  mockSend.mockResolvedValueOnce({ answer: 'A'.repeat(800), actions: Array.from({ length: 5 }, (_, index) => ({ type: 'add_expense', title: `Taxi ${index}`, amount: '24', currency: 'USD' })) })
    .mockResolvedValueOnce({ answer: 'OK', actions: [] });
  await act(async () => { await chat.send('Prepare expenses'); });
  const assistant = chat.turns.find(({ role }) => role === 'assistant');
  if (!assistant) throw new Error('Missing assistant turn');
  act(() => chat.setStatus(assistant.id, 4, 'opened'));
  await act(async () => { await chat.send('What happened?'); });
  const normalized = mockSend.mock.calls[1][0].messages[1].text.slice(0, 600);
  expect(normalized).toContain('[pending] add_expense Taxi 0');
  expect(normalized).toContain('[opened] add_expense Taxi 4');
  expect(normalized).toHaveLength(600);
});
