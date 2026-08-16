const inviteTokenPattern = /^[a-f0-9]{48}$/i;
const defaultAppUrl = 'https://tripflow.fun';

/**
 * Hosts an invite link may legitimately carry. The canonical domain is the
 * default, but the Vercel alias still serves the app and older invites were
 * issued against it, so both stay trusted — a traveller must not be told a
 * genuine invite is invalid because it names the other host.
 */
const trustedInviteHosts = new Set(['tripflow.fun', 'www.tripflow.fun', 'tripflow-liart.vercel.app']);

function appUrl() {
  const configured = process.env.EXPO_PUBLIC_APP_URL?.trim();
  return configured?.startsWith('https://') ? configured.replace(/\/$/, '') : defaultAppUrl;
}

export function isInviteToken(value: string) {
  return inviteTokenPattern.test(value.trim());
}

export function buildInviteUrl(token: string) {
  const normalized = token.trim().toLowerCase();
  if (!isInviteToken(normalized)) throw new Error('Invite token is invalid');
  return `${appUrl()}/explore?invite=${normalized}`;
}

export function parseInviteToken(value: string) {
  const normalized = value.trim();
  if (isInviteToken(normalized)) return normalized.toLowerCase();

  try {
    const url = new URL(normalized);
    const configuredHost = new URL(appUrl()).host;
    const isTrustedWebInvite = url.protocol === 'https:'
      && (url.host === configuredHost || trustedInviteHosts.has(url.host))
      && url.pathname.replace(/\/$/, '') === '/explore';
    const isAppInvite = url.protocol === 'tripflow:'
      && (url.hostname === 'explore' || url.pathname.replace(/^\//, '') === 'explore');
    if (!isTrustedWebInvite && !isAppInvite) return undefined;
    const token = url.searchParams.get('invite') ?? '';
    return isInviteToken(token) ? token.toLowerCase() : undefined;
  } catch {
    return undefined;
  }
}
