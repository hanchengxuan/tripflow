const inviteTokenPattern = /^[a-f0-9]{48}$/i;
const defaultAppUrl = 'https://tripflow-liart.vercel.app';

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
    const trustedWebUrl = new URL(appUrl());
    const isTrustedWebInvite = url.protocol === 'https:'
      && url.host === trustedWebUrl.host
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
