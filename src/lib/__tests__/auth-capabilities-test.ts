import { loadAuthCapabilities } from '@/lib/auth-capabilities';

describe('loadAuthCapabilities', () => {
  it('returns configured external providers', async () => {
    const capabilities = await loadAuthCapabilities(async () => new Response(JSON.stringify({ external: { google: true, phone: false } }), { status: 200 }));
    expect(capabilities).toEqual({ google: true, phone: false });
  });

  it('returns no capabilities when the settings request fails', async () => {
    const capabilities = await loadAuthCapabilities(async () => { throw new Error('Network unavailable'); });
    expect(capabilities).toEqual({ google: false, phone: false });
  });

  it('returns no capabilities for an unsuccessful response', async () => {
    const capabilities = await loadAuthCapabilities(async () => new Response(null, { status: 503 }));
    expect(capabilities).toEqual({ google: false, phone: false });
  });
});
