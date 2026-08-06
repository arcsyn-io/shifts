import type { AuthConfig } from '../../../auth.tokens.js';

const REFRESH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export interface AuthCookies {
  accessToken?: string;
  refreshToken?: string;
}

interface SessionCookiesInput {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export function readAuthCookies(config: AuthConfig, header?: string): AuthCookies {
  const parsed = parseCookieHeader(header);
  if (!parsed) return {};
  const names = getCookieNames(config);
  const accessToken = parsed[names.access];
  const refreshToken = parsed[names.refresh];
  return {
    ...(accessToken ? { accessToken } : {}),
    ...(refreshToken ? { refreshToken } : {}),
  };
}

export function createSessionCookies(config: AuthConfig, session: SessionCookiesInput): string[] {
  const names = getCookieNames(config);
  return [
    serializeCookie(config, names.access, session.accessToken, '/api', session.expiresIn),
    serializeCookie(
      config,
      names.refresh,
      session.refreshToken,
      '/api/auth',
      REFRESH_MAX_AGE_SECONDS,
    ),
  ];
}

export function clearSessionCookies(config: AuthConfig): string[] {
  const names = getCookieNames(config);
  return [
    serializeCookie(config, names.access, '', '/api', 0),
    serializeCookie(config, names.refresh, '', '/api/auth', 0),
  ];
}

function getCookieNames(config: AuthConfig): { access: string; refresh: string } {
  const prefix = config.nodeEnvironment === 'production' ? '__Secure-' : '';
  return { access: `${prefix}arcsyn_access`, refresh: `${prefix}arcsyn_refresh` };
}

function parseCookieHeader(header?: string): Record<string, string> | undefined {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const rawPart of header.split(';')) {
    const separator = rawPart.indexOf('=');
    if (separator < 1) continue;
    const name = rawPart.slice(0, separator).trim();
    const value = rawPart.slice(separator + 1).trim();
    if (!name || name in cookies) return undefined;
    cookies[name] = value;
  }
  return cookies;
}

function serializeCookie(
  config: AuthConfig,
  name: string,
  value: string,
  path: string,
  maxAge: number,
): string {
  const attributes = [
    `${name}=${value}`,
    `Path=${path}`,
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (config.nodeEnvironment === 'production') attributes.push('Secure');
  if (maxAge === 0) attributes.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  return attributes.join('; ');
}
