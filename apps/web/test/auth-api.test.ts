import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AuthApiError,
  fetchSessionWithRefresh,
  login,
  logout,
  readCsrfToken,
} from '@/features/auth/api/authApi';

const validSession = {
  authenticated: true as const,
  user: {
    id: '4e16029a-5347-4adc-996b-6f01289b5983',
    email: 'person@example.com',
  },
  csrfToken: 'csrf-token-with-at-least-thirty-two-characters',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('auth API', () => {
  it('normalizes login input and validates the session response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(validSession));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      login({ email: ' Person@Example.com ', password: 'correct horse battery staple' }),
    ).resolves.toEqual(validSession);

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'person@example.com',
        password: 'correct horse battery staple',
      }),
    });
  });

  it('does not persist session data in browser storage', async () => {
    const localStorage = { getItem: vi.fn(), setItem: vi.fn() };
    const sessionStorage = { getItem: vi.fn(), setItem: vi.fn() };
    vi.stubGlobal('localStorage', localStorage);
    vi.stubGlobal('sessionStorage', sessionStorage);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(validSession)));

    await login({ email: 'person@example.com', password: 'password' });

    expect(localStorage.getItem).not.toHaveBeenCalled();
    expect(localStorage.setItem).not.toHaveBeenCalled();
    expect(sessionStorage.getItem).not.toHaveBeenCalled();
    expect(sessionStorage.setItem).not.toHaveBeenCalled();
  });

  it('rejects a successful response outside the shared contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ authenticated: true, user: validSession.user, accessToken: 'secret' }),
        ),
    );

    await expect(login({ email: 'person@example.com', password: 'password' })).rejects.toThrow();
  });

  it('performs one coordinated refresh when concurrent session reads return 401', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/auth/session') return Promise.resolve(new Response(null, { status: 401 }));
      if (url === '/api/auth/refresh') return Promise.resolve(jsonResponse(validSession));
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      Promise.all([
        fetchSessionWithRefresh(undefined, 'csrf-from-cookie'),
        fetchSessionWithRefresh(undefined, 'csrf-from-cookie'),
      ]),
    ).resolves.toEqual([validSession, validSession]);

    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/auth/session')).toHaveLength(2);
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/auth/refresh')).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/refresh', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'x-csrf-token': 'csrf-from-cookie' },
    });
  });

  it('treats a rejected refresh as an absent session', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchSessionWithRefresh(undefined, 'csrf-from-cookie')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not refresh a session after a non-authentication failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchSessionWithRefresh(undefined, 'csrf-from-cookie')).rejects.toBeInstanceOf(
      AuthApiError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends the session CSRF token when logging out', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(logout(validSession.csrfToken)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/session', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'x-csrf-token': validSession.csrfToken },
    });
  });
});

describe('readCsrfToken', () => {
  it('reads only the public development CSRF cookie', () => {
    expect(
      readCsrfToken(
        'arcsyn_access=not-readable-in-a-browser; arcsyn_csrf=csrf%2Fvalue; arcsyn_refresh=hidden',
        false,
      ),
    ).toBe('csrf/value');
  });

  it('prioritizes the prefixed CSRF cookie in production', () => {
    expect(
      readCsrfToken('arcsyn_csrf=development-token; __Host-arcsyn_csrf=production-token', true),
    ).toBe('production-token');
  });

  it('uses the alternate public CSRF name as an environment-transition fallback', () => {
    expect(readCsrfToken('__Host-arcsyn_csrf=production-token', false)).toBe('production-token');
    expect(readCsrfToken('arcsyn_csrf=development-token', true)).toBe('development-token');
  });

  it('returns undefined for a malformed encoded cookie', () => {
    expect(readCsrfToken('arcsyn_csrf=%E0%A4%A', false)).toBeUndefined();
  });
});
