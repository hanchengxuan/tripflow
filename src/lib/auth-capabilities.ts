export interface AuthCapabilities {
  google: boolean;
  phone: boolean;
}

const noCapabilities: AuthCapabilities = { google: false, phone: false };

export async function loadAuthCapabilities(request: () => Promise<Response>): Promise<AuthCapabilities> {
  try {
    const response = await request();
    if (!response.ok) return noCapabilities;
    const settings = await response.json() as { external?: Record<string, boolean> };
    return { google: Boolean(settings.external?.google), phone: Boolean(settings.external?.phone) };
  } catch {
    return noCapabilities;
  }
}
