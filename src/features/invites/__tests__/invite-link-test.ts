import { buildInviteUrl, parseInviteToken } from '@/features/invites/invite-link';

const token = 'abcdef0123456789abcdef0123456789abcdef0123456789';

describe('invite links', () => {
  it('builds and parses the production invite URL', () => {
    const url = buildInviteUrl(token);
    expect(url).toBe(`https://tripflow.fun/explore?invite=${token}`);
    expect(parseInviteToken(url)).toBe(token);
  });

  it('accepts a raw token and a TripFlow app link', () => {
    expect(parseInviteToken(token.toUpperCase())).toBe(token);
    expect(parseInviteToken(`tripflow://explore?invite=${token}`)).toBe(token);
  });

  it('rejects untrusted hosts, paths, and malformed tokens', () => {
    expect(parseInviteToken(`https://example.com/explore?invite=${token}`)).toBeUndefined();
    expect(parseInviteToken(`https://tripflow.fun/privacy?invite=${token}`)).toBeUndefined();
    expect(parseInviteToken('not-an-invite')).toBeUndefined();
  });
});

describe('trusted invite hosts', () => {
  const token = 'a'.repeat(48);

  it('accepts an invite issued against the Vercel alias', () => {
    // Older invites name the alias; rejecting them would tell a traveller a
    // genuine invite is invalid.
    expect(parseInviteToken(`https://tripflow-liart.vercel.app/explore?invite=${token}`)).toBe(token);
  });

  it('accepts the www form of the canonical domain', () => {
    expect(parseInviteToken(`https://www.tripflow.fun/explore?invite=${token}`)).toBe(token);
  });

  it('still rejects a look-alike host', () => {
    expect(parseInviteToken(`https://tripflow.fun.evil.example/explore?invite=${token}`)).toBeUndefined();
    expect(parseInviteToken(`https://nottripflow.fun/explore?invite=${token}`)).toBeUndefined();
  });

  it('still rejects a trusted host on the wrong path', () => {
    expect(parseInviteToken(`https://tripflow.fun/privacy?invite=${token}`)).toBeUndefined();
  });
});
