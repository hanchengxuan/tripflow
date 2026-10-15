import { parseExpenseAudio, parseExpenseImage, parseExpenseText } from '@/features/ai/expense-parser';

const mockInvoke = jest.fn();
jest.mock('@/lib/supabase', () => ({ getSupabaseClient: () => ({ functions: { invoke: mockInvoke } }) }));

const draft = { title: 'Lawson', amount: '780', currency: 'JPY', payerUserId: 'me', participantUserIds: ['me'], confidence: 0.9, warnings: [] };

beforeEach(() => mockInvoke.mockReset());

test('a receipt photo is sent as an image and returns a validated draft', async () => {
  mockInvoke.mockResolvedValue({ data: { draft }, error: null });
  await expect(parseExpenseImage({ tripId: 'trip', imageBase64: 'AAAA', imageMimeType: 'image/jpeg', memberIds: ['me'] })).resolves.toMatchObject({ title: 'Lawson', amount: '780' });
  expect(mockInvoke).toHaveBeenCalledWith('parse-expense', { body: { tripId: 'trip', imageBase64: 'AAAA', imageMimeType: 'image/jpeg' } });
});

test('text and voice keep their request shapes', async () => {
  mockInvoke.mockResolvedValue({ data: { draft }, error: null });
  await parseExpenseText({ tripId: 'trip', text: ' Lunch 780 ', memberIds: ['me'] });
  await parseExpenseAudio({ tripId: 'trip', audioBase64: 'BBBB', audioMimeType: 'audio/webm', memberIds: ['me'] });
  expect(mockInvoke.mock.calls.map(([, options]) => options.body)).toEqual([
    { tripId: 'trip', text: 'Lunch 780' },
    { tripId: 'trip', audioBase64: 'BBBB', audioMimeType: 'audio/webm' },
  ]);
});

test('an oversized photo is rejected before upload', async () => {
  await expect(parseExpenseImage({ tripId: 'trip', imageBase64: 'A'.repeat(8_000_001), imageMimeType: 'image/jpeg', memberIds: ['me'] })).rejects.toThrow('小票照片过大');
  expect(mockInvoke).not.toHaveBeenCalled();
});

test('the server’s readable Chinese error reaches the traveller', async () => {
  const context = new Response(JSON.stringify({ error: 'AI 解析暂时不可用，请稍后重试或手动填写。' }), { status: 502 });
  mockInvoke.mockResolvedValue({ data: null, error: Object.assign(new Error('Edge Function returned a non-2xx status code'), { context }) });
  await expect(parseExpenseImage({ tripId: 'trip', imageBase64: 'AAAA', imageMimeType: 'image/jpeg', memberIds: ['me'] })).rejects.toThrow('AI 解析暂时不可用');
});
