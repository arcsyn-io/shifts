import {
  authSessionResponseSchema,
  loginRequestSchema,
  type AuthSessionResponse,
  type LoginRequest,
} from '@arcsyn-shift/contracts';

const AUTH_ENDPOINTS = {
  login: '/api/auth/login',
  refresh: '/api/auth/refresh',
  session: '/api/auth/session',
} as const;

const CSRF_HEADER_NAME = 'x-csrf-token';

let pendingRefresh: Promise<AuthSessionResponse> | undefined;

export class AuthApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'AuthApiError';
  }
}

function isUnauthorized(error: unknown) {
  return error instanceof AuthApiError && (error.status === 401 || error.status === 403);
}

async function parseSessionResponse(response: Response): Promise<AuthSessionResponse> {
  if (!response.ok) {
    throw new AuthApiError('Authentication request failed', response.status);
  }

  const body: unknown = await response.json();
  return authSessionResponseSchema.parse(body);
}

function requestInit(init?: RequestInit): RequestInit {
  return {
    ...init,
    credentials: 'same-origin',
  };
}

export function readCsrfToken(
  cookieSource = typeof document === 'undefined' ? '' : document.cookie,
  production = import.meta.env.PROD,
) {
  const cookieNames = production
    ? ['__Host-arcsyn_csrf', 'arcsyn_csrf']
    : ['arcsyn_csrf', '__Host-arcsyn_csrf'];
  const cookies = new Map(
    cookieSource.split(';').map((part) => {
      const separator = part.indexOf('=');
      if (separator < 0) return [part.trim(), ''] as const;
      return [part.slice(0, separator).trim(), part.slice(separator + 1)] as const;
    }),
  );
  const encodedValue = cookieNames.map((name) => cookies.get(name)).find(Boolean);

  if (!encodedValue) return undefined;

  try {
    return decodeURIComponent(encodedValue);
  } catch {
    return undefined;
  }
}

export async function login(input: LoginRequest): Promise<AuthSessionResponse> {
  const payload = loginRequestSchema.parse(input);
  const response = await fetch(
    AUTH_ENDPOINTS.login,
    requestInit({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  );

  return parseSessionResponse(response);
}

export async function fetchSession(signal?: AbortSignal): Promise<AuthSessionResponse> {
  const response = await fetch(
    AUTH_ENDPOINTS.session,
    requestInit(signal ? { signal } : undefined),
  );

  return parseSessionResponse(response);
}

export async function refreshSession(csrfToken = readCsrfToken()): Promise<AuthSessionResponse> {
  if (!csrfToken) {
    throw new AuthApiError('CSRF token is unavailable', 401);
  }

  if (!pendingRefresh) {
    pendingRefresh = fetch(
      AUTH_ENDPOINTS.refresh,
      requestInit({
        method: 'POST',
        headers: { [CSRF_HEADER_NAME]: csrfToken },
      }),
    )
      .then(parseSessionResponse)
      .finally(() => {
        pendingRefresh = undefined;
      });
  }

  return pendingRefresh;
}

export async function fetchSessionWithRefresh(
  signal?: AbortSignal,
  csrfToken = readCsrfToken(),
): Promise<AuthSessionResponse | null> {
  try {
    return await fetchSession(signal);
  } catch (error) {
    if (!(error instanceof AuthApiError) || error.status !== 401) throw error;
  }

  try {
    return await refreshSession(csrfToken);
  } catch (error) {
    if (isUnauthorized(error)) return null;
    throw error;
  }
}

export async function logout(csrfToken: string): Promise<void> {
  const response = await fetch(
    AUTH_ENDPOINTS.session,
    requestInit({
      method: 'DELETE',
      headers: { [CSRF_HEADER_NAME]: csrfToken },
    }),
  );

  if (!response.ok) {
    throw new AuthApiError('Logout request failed', response.status);
  }
}

export function isSessionRejected(error: unknown) {
  return isUnauthorized(error);
}
