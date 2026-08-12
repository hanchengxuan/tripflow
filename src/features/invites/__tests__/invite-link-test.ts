import { buildInviteUrl, parseInviteToken } from '@/features/invites/invite-link';

const token = 'abcdef0123456789abcdef0123456789abcdef0123456789';

describe('invite links', () => {
  it('builds and parses the production invite URL', () => {
    const url = buildInviteUrl(token);
    expect(url).toBe(`https://tripflow-liart.vercel.app/explore?invite=${token}`);
    expect(parseInviteToken(url)).toBe(token);
  });

  it('accepts a raw token and a TripFlow app link', () => {
    expect(parseInviteToken(token.toUpperCase())).toBe(token);
    expect(parseInviteToken(`tripflow://explore?invite=${token}`)).toBe(token);
  });

  it('rejects untrusted hosts, paths, and malformed tokens', () => {
    expect(parseInviteToken(`https://example.com/explore?invite=${token}`)).toBeUndefined();
    expect(parseInviteToken(`https://tripflow-liart.vercel.app/privacy?invite=${token}`)).toBeUndefined();
    expect(parseInviteToken('not-an-invite')).toBeUndefined();
  });
});
