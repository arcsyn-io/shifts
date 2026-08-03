import type { AppConfig } from '@arcsyn-shift/config';

const ACCESS_MAX_AGE_SECONDS = 10 * 60;
const REFRESH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export interface AuthCookieNames {
  access: string;
  refresh: string;
  csrf: string;
}

export const getAuthCookieNames = (config: AppConfig): AuthCookieNames => ({
  access: config.NODE_ENV === 'production' ? '__Host-arcsyn_access' : 'arcsyn_access',
  refresh: config.NODE_ENV === 'production' ? '__Host-arcsyn_refresh' : 'arcsyn_refresh',
  csrf: config.NODE_ENV === 'production' ? '__Host-arcsyn_csrf' : 'arcsyn_csrf',
});

export const parseCookies = (header: string | undefined): Readonly<Record<string, string>> => {
  if (!header) return {};
  const cookies: Record<string, string> = {};
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name && !(name in cookies)) cookies[name] = value;
  }
  return cookies;
};

const serializeCookie = (
  name: string,
  value: string,
  input: { httpOnly: boolean; secure: boolean; maxAge: number },
): string => {
  const attributes = [`${name}=${value}`, 'Path=/', `Max-Age=${input.maxAge}`, 'SameSite=Lax'];
  if (input.httpOnly) attributes.push('HttpOnly');
  if (input.secure) attributes.push('Secure');
  if (input.maxAge === 0) attributes.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  return attributes.join('; ');
};

export const createSessionCookies = (
  config: AppConfig,
  session: { accessToken: string; refreshToken: string; csrfToken: string },
): string[] => {
  const names = getAuthCookieNames(config);
  const secure = config.NODE_ENV === 'production';
  return [
    serializeCookie(names.access, session.accessToken, {
      httpOnly: true,
      secure,
      maxAge: ACCESS_MAX_AGE_SECONDS,
    }),
    serializeCookie(names.refresh, session.refreshToken, {
      httpOnly: true,
      secure,
      maxAge: REFRESH_MAX_AGE_SECONDS,
    }),
    serializeCookie(names.csrf, session.csrfToken, {
      httpOnly: false,
      secure,
      maxAge: REFRESH_MAX_AGE_SECONDS,
    }),
  ];
};

export const clearSessionCookies = (config: AppConfig): string[] => {
  const names = getAuthCookieNames(config);
  const secure = config.NODE_ENV === 'production';
  return [
    serializeCookie(names.access, '', { httpOnly: true, secure, maxAge: 0 }),
    serializeCookie(names.refresh, '', { httpOnly: true, secure, maxAge: 0 }),
    serializeCookie(names.csrf, '', { httpOnly: false, secure, maxAge: 0 }),
  ];
};
