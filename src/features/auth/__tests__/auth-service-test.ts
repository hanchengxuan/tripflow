import { deleteAccount, normalizeEmail } from '@/features/auth/auth-service';

const mockRpc = jest.fn();
const mockSignOut = jest.fn();
const mockSingle = jest.fn();
const mockRemove = jest.fn();

jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({
    from: () => ({ select: () => ({ single: mockSingle }) }),
    storage: { from: () => ({ remove: mockRemove }) },
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
    mockSingle.mockResolvedValueOnce({ data: { avatar_path: 'user/avatar.png' }, error: null });
    mockRemove.mockResolvedValueOnce({ error: null });
    mockRpc.mockResolvedValueOnce({ error: null });
    mockSignOut.mockResolvedValueOnce({ error: null });

    await deleteAccount();

    expect(mockRemove).toHaveBeenCalledWith(['user/avatar.png']);
    expect(mockRpc).toHaveBeenCalledWith('delete_current_account');
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(mockRemove.mock.invocationCallOrder[0]).toBeLessThan(mockRpc.mock.invocationCallOrder[0]);
    expect(mockRpc.mock.invocationCallOrder[0]).toBeLessThan(mockSignOut.mock.invocationCallOrder[0]);
  });
});
