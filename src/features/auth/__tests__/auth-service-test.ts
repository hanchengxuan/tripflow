import { deleteAccount, normalizeEmail } from '@/features/auth/auth-service';

const mockRpc = jest.fn();
const mockSignOut = jest.fn();

jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({
    rpc: mockRpc,
    auth: { signOut: mockSignOut },
  }),
}));

describe('normalizeEmail', () => {
  it('normalizes casing and whitespace', () => {
    expect(normalizeEmail('  Liam@Example.COM ')).toBe('liam@example.com');
  });

  it('rejects an invalid address', () => {
    expect(() => normalizeEmail('not-an-email')).toThrow('请输入有效的邮箱地址。');
  });

  it('deletes the backend account before clearing the local session', async () => {
    mockRpc.mockResolvedValueOnce({ error: null });
    mockSignOut.mockResolvedValueOnce({ error: null });

    await deleteAccount();

    expect(mockRpc).toHaveBeenCalledWith('delete_current_account');
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(mockRpc.mock.invocationCallOrder[0]).toBeLessThan(mockSignOut.mock.invocationCallOrder[0]);
  });
});
