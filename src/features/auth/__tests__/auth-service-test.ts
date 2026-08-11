import { normalizeEmail } from '@/features/auth/auth-service';

describe('normalizeEmail', () => {
  it('normalizes casing and whitespace', () => {
    expect(normalizeEmail('  Liam@Example.COM ')).toBe('liam@example.com');
  });

  it('rejects an invalid address', () => {
    expect(() => normalizeEmail('not-an-email')).toThrow('Enter a valid email address.');
  });
});
