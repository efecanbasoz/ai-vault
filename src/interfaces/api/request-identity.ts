export interface RequestIdentityInput {
  headers: Headers;
  path: string;
  userId?: string | null;
  trustProxyHeaders: boolean;
}

export interface AuthorizationIdentityInput {
  authorizationHeader: string | null | undefined;
  apiKeyConfigured: boolean;
  validateApiKey: (token: string) => boolean;
  resolveUserIdFromApiKey: (token: string) => string;
}

function firstHeaderValue(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(',')[0]?.trim();
  return first ? first : null;
}

export function getTrustedClientIp(headers: Headers, trustProxyHeaders: boolean): string | null {
  if (!trustProxyHeaders) {
    return null;
  }

  return firstHeaderValue(headers.get('x-forwarded-for')) ?? firstHeaderValue(headers.get('x-real-ip'));
}

export function buildRateLimitKey(input: RequestIdentityInput): string {
  if (input.userId) {
    return `user:${input.userId}:${input.path}`;
  }

  const trustedIp = getTrustedClientIp(input.headers, input.trustProxyHeaders);
  if (trustedIp) {
    return `ip:${trustedIp}:${input.path}`;
  }

  const userAgent = firstHeaderValue(input.headers.get('user-agent'));
  if (userAgent) {
    return `agent:${userAgent}:${input.path}`;
  }

  return `anonymous:${input.path}`;
}

export function resolveRateLimitUserId(input: AuthorizationIdentityInput): string | null {
  if (!input.apiKeyConfigured || !input.authorizationHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = input.authorizationHeader.slice(7);
  if (!input.validateApiKey(token)) {
    return null;
  }

  return input.resolveUserIdFromApiKey(token);
}
