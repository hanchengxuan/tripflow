import { assertPasswordChange, completeRegistration, deleteAccount, normalizeEmail, normalizeEmailOtp, normalizePhone, sendEmailOtp, validatePassword } from '@/features/auth/auth-service';
import { updateProfile } from '@/data/trip-repository';

const mockRpc = jest.fn();
const mockSignOut = jest.fn();
const mockSingle = jest.fn();
const mockRemove = jest.fn();
const mockSignInWithOtp = jest.fn();
const mockUpdateUser = jest.fn();
const mockUpdateProfile = updateProfile as jest.MockedFunction<typeof updateProfile>;

jest.mock('@/data/trip-repository', () => ({ updateProfile: jest.fn() }));

jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({
    from: () => ({ select: () => ({ single: mockSingle }) }),
    storage: { from: () => ({ remove: mockRemove }) },
    rpc: mockRpc,
    auth: { signOut: mockSignOut, signInWithOtp: mockSignInWithOtp, updateUser: mockUpdateUser },
  }),
}));

describe('normalizeEmail', () => {
  beforeEach(() => jest.clearAllMocks());

  it('normalizes casing and whitespace', () => {
    expect(normalizeEmail('  Liam@Example.COM ')).toBe('liam@example.com');
  });

  it('rejects an invalid address', () => {
    expect(() => normalizeEmail('not-an-email')).toThrow('请输入有效的邮箱地址。');
  });

  it('requires a password with at least eight characters, letters, and numbers', () => {
    expect(validatePassword('travel2026')).toBe('travel2026');
    expect(() => validatePassword('short1')).toThrow('密码至少 8 位');
    expect(() => validatePassword('onlyletters')).toThrow('密码至少 8 位');
    expect(() => validatePassword('12345678')).toThrow('密码至少 8 位');
  });

  it('requires the configured eight-digit OTP length', () => {
    expect(normalizeEmailOtp('87306620')).toBe('87306620');
    expect(normalizeEmailOtp('1234 5678')).toBe('12345678');
    expect(() => normalizeEmailOtp('123456')).toThrow('8 位');
    expect(() => normalizeEmailOtp('1234567890')).toThrow('8 位');
    expect(() => normalizeEmailOtp('1234ABCD')).toThrow('8 位');
  });

  it('normalizes E.164 phone numbers', () => {
    expect(normalizePhone('+61 412 345 678')).toBe('+61412345678');
    expect(() => normalizePhone('0412345678')).toThrow('国家区号');
  });

  it('creates users only in the registration OTP flow', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null });
    await sendEmailOtp('new@example.com', true);
    await sendEmailOtp('member@example.com', false);
    expect(mockSignInWithOtp).toHaveBeenNthCalledWith(1, { email: 'new@example.com', options: { shouldCreateUser: true } });
    expect(mockSignInWithOtp).toHaveBeenNthCalledWith(2, { email: 'member@example.com', options: { shouldCreateUser: false } });
  });

  it('sets the password before completing the profile onboarding gate', async () => {
    mockUpdateUser.mockResolvedValue({ error: null });
    mockUpdateProfile.mockResolvedValue(undefined);
    mockRpc.mockResolvedValue({ error: null });
    await completeRegistration({ userId: 'user-a', displayName: ' Liam ', password: 'travel2026' });
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'travel2026', data: { display_name: 'Liam' } });
    expect(mockUpdateProfile).toHaveBeenCalledWith('user-a', { displayName: 'Liam', avatar: undefined });
    expect(mockRpc).toHaveBeenCalledWith('complete_profile_onboarding');
    expect(mockUpdateUser.mock.invocationCallOrder[0]).toBeLessThan(mockUpdateProfile.mock.invocationCallOrder[0]);
    expect(mockUpdateProfile.mock.invocationCallOrder[0]).toBeLessThan(mockRpc.mock.invocationCallOrder[0]);
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

describe('assertPasswordChange', () => {
  it('requires the current password', () => {
    expect(() => assertPasswordChange('', 'newpass123')).toThrow('请输入当前密码。');
  });

  it('rejects a new password identical to the current one', () => {
    expect(() => assertPasswordChange('samepass1', 'samepass1')).toThrow('新密码不能与当前密码相同。');
  });

  it('applies the password policy to the new password', () => {
    expect(() => assertPasswordChange('current123', 'short1')).toThrow();
    expect(() => assertPasswordChange('current123', 'alllettersonly')).toThrow();
    expect(() => assertPasswordChange('current123', '12345678')).toThrow();
  });

  it('checks policy before anything that would need the current password', () => {
    // A bad new password must fail on its own terms, so a rejection never
    // signals whether the current password was right.
    expect(() => assertPasswordChange('wrong', 'short1')).toThrow('密码至少 8 位，并同时包含字母和数字。');
  });

  it('returns the accepted new password', () => {
    expect(assertPasswordChange('current123', 'brandnew123')).toBe('brandnew123');
  });
});
