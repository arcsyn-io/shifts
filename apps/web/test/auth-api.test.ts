import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthRequestError, fetchSession, login } from '@/features/auth/api/auth';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('auth API', () => {
  it('restores a session with same-origin credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          principal: { id: '9d1665ae-2928-456f-92d8-d5f652f4f1f3', email: 'dev@example.test' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchSession()).resolves.toEqual({
      principal: { id: '9d1665ae-2928-456f-92d8-d5f652f4f1f3', email: 'dev@example.test' },
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/session', {
      credentials: 'same-origin',
    });
  });

  it('submits credentials only to the same-origin BFF', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          principal: { id: '9d1665ae-2928-456f-92d8-d5f652f4f1f3', email: 'dev@example.test' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await login({ email: 'dev@example.test', password: 'valid-password' });

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dev@example.test', password: 'valid-password' }),
    });
  });

  it('keeps the HTTP status when authentication fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 'AUTH_UNAUTHORIZED',
            message: 'Authentication required',
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    await expect(fetchSession()).rejects.toEqual(
      expect.objectContaining<AuthRequestError>({
        name: 'AuthRequestError',
        status: 401,
        message: 'Authentication required',
      }),
    );
  });

  it('rejects successful responses outside the shared session contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ principal: { id: 'invalid' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(fetchSession()).rejects.toThrow();
  });
});
