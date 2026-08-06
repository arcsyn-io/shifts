import 'reflect-metadata';
import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import type { AuthConfig } from '../src/modules/auth/auth.tokens.js';
import { AuthController } from '../src/modules/auth/presentation/http/auth.controller.js';
import {
  clearSessionCookies,
  createSessionCookies,
  readAuthCookies,
} from '../src/modules/auth/presentation/http/mappers/auth-cookies.mapper.js';
import { SupabaseAuthRepository } from '../src/modules/auth/repository/supabase-auth.repository.js';
import { AuthError } from '../src/modules/auth/auth.error.js';

const config: AuthConfig = {
  nodeEnvironment: 'test',
  supabaseUrl: 'http://127.0.0.1:54321',
  supabasePublishableKey: 'publishable-key',
  webOrigin: 'http://localhost:5173',
};
const principal = {
  id: '6aa5bbc6-4888-4b72-a2a7-37ca3bdb786f',
  email: 'user@example.com',
};
const session = {
  principal,
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresIn: 3600,
};

function request(headers: Record<string, string>): FastifyRequest {
  return { headers } as unknown as FastifyRequest;
}

function reply(): FastifyReply {
  return { header: vi.fn() } as unknown as FastifyReply;
}

function createController(input: {
  login?: ReturnType<typeof vi.fn>;
  getSession?: ReturnType<typeof vi.fn>;
  logout?: ReturnType<typeof vi.fn>;
}): AuthController {
  return new AuthController(
    { execute: input.login ?? vi.fn() },
    { execute: input.getSession ?? vi.fn() },
    { execute: input.logout ?? vi.fn() },
    config,
  );
}

describe('auth HTTP security boundary', () => {
  it('scopes HttpOnly cookies away from /mcp and enables Secure in production', () => {
    const cookies = createSessionCookies({ ...config, nodeEnvironment: 'production' }, session);
    expect(cookies).toHaveLength(2);
    expect(cookies[0]).toContain('__Secure-arcsyn_access=access-token');
    expect(cookies[0]).toContain('Path=/api;');
    expect(cookies[1]).toContain('__Secure-arcsyn_refresh=refresh-token');
    expect(cookies[1]).toContain('Path=/api/auth;');
    for (const cookie of cookies) {
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Secure');
      expect(cookie).not.toContain('Domain=');
    }
  });

  it('clears cookies with the same security attributes and paths', () => {
    const cleared = clearSessionCookies({ ...config, nodeEnvironment: 'production' });
    expect(cleared[0]).toContain('Path=/api; Max-Age=0; HttpOnly; SameSite=Lax; Secure;');
    expect(cleared[1]).toContain('Path=/api/auth; Max-Age=0; HttpOnly; SameSite=Lax; Secure;');
  });

  it('rejects duplicate cookie shadowing', () => {
    expect(
      readAuthCookies(config, 'arcsyn_access=first; arcsyn_access=second; arcsyn_refresh=refresh'),
    ).toEqual({});
  });

  it.each([undefined, 'https://evil.example'])(
    'rejects an absent or foreign Origin',
    async (origin) => {
      const execute = vi.fn();
      const controller = createController({ login: execute });
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (origin) headers.origin = origin;

      await expect(
        controller.login({ email: principal.email, password: 'secret' }, request(headers), reply()),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it('rejects a same-host Origin that is not the configured WEB_URL', async () => {
    const controller = createController({ login: vi.fn().mockResolvedValue(session) });

    await expect(
      controller.login(
        { email: principal.email, password: 'secret' },
        request({
          origin: 'http://192.168.1.20:5173',
          host: '192.168.1.20:5173',
          'content-type': 'application/json',
        }),
        reply(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns only the public principal and writes tokens only as Set-Cookie', async () => {
    const controller = createController({ login: vi.fn().mockResolvedValue(session) });
    const response = createReplyRecorder();

    const result = await controller.login(
      { email: principal.email, password: 'secret' },
      request({ origin: config.webOrigin, 'content-type': 'application/json' }),
      response.reply,
    );
    expect(result).toEqual({ principal });
    expect(JSON.stringify(result)).not.toContain('access-token');
    expect(JSON.stringify(result)).not.toContain('refresh-token');
    expect(response.headers['Set-Cookie']).toEqual(expect.arrayContaining([expect.any(String)]));
  });

  it('rejects Bearer authentication on the BFF session route as 401', async () => {
    const execute = vi.fn();
    const controller = createController({ getSession: execute });

    await expect(
      controller.session(request({ authorization: 'Bearer token' }), reply()),
    ).rejects.toMatchObject({ status: 401 });
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([
    ['a foreign Origin', { origin: 'https://evil.example' }],
    ['absent origin metadata', {}],
    ['a cross-site request', { 'sec-fetch-site': 'cross-site' }],
    ['a same-site request', { 'sec-fetch-site': 'same-site' }],
    ['a browser-external request', { 'sec-fetch-site': 'none' }],
  ])('rejects %s before refreshing a session', async (_scenario, headers) => {
    const execute = vi
      .fn()
      .mockImplementation((credentials: { allowRefresh?: boolean }) =>
        credentials.allowRefresh
          ? Promise.resolve({ response: { principal } })
          : Promise.reject(new AuthError('forbidden')),
      );
    const controller = createController({ getSession: execute });
    await expect(
      controller.session(
        request({
          ...headers,
          cookie: 'arcsyn_refresh=refresh-token',
        }),
        reply(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(execute).toHaveBeenCalledWith({
      refreshToken: 'refresh-token',
      allowRefresh: false,
    });
  });

  it.each([
    ['the configured Origin', { origin: config.webOrigin }],
    ['Sec-Fetch-Site same-origin without Origin', { 'sec-fetch-site': 'same-origin' }],
  ])('allows refresh for %s', async (_scenario, headers) => {
    const execute = vi.fn().mockResolvedValue({ response: { principal } });
    const controller = createController({ getSession: execute });

    await expect(
      controller.session(
        request({
          ...headers,
          cookie: 'arcsyn_refresh=refresh-token',
        }),
        reply(),
      ),
    ).resolves.toEqual({ principal });
    expect(execute).toHaveBeenCalledWith({
      refreshToken: 'refresh-token',
      allowRefresh: true,
    });
  });

  it('clears cookies even when Supabase logout is unavailable', async () => {
    const controller = createController({
      logout: vi.fn().mockRejectedValue(new Error('upstream details must not escape')),
    });
    const response = createReplyRecorder();

    await expect(
      controller.logout(request({ origin: config.webOrigin }), response.reply),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(response.headers['Set-Cookie']).toEqual(clearSessionCookies(config));
  });
});

describe('SupabaseAuthRepository', () => {
  it('uses only the configured publishable key and validates the session response', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          expires_in: 3600,
          user: principal,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const provider = new SupabaseAuthRepository(config, fetcher as unknown as typeof fetch);

    await expect(provider.signIn(principal.email, 'secret')).resolves.toEqual({
      status: 'success',
      value: session,
    });
    expect(fetcher).toHaveBeenCalledWith(
      new URL('http://127.0.0.1:54321/auth/v1/token?grant_type=password'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ apikey: 'publishable-key' }),
        redirect: 'error',
      }),
    );
  });

  it.each([
    [401, { status: 'unauthorized' }],
    [503, { status: 'unavailable' }],
  ])('classifies Supabase status %s without exposing its body', async (status, expected) => {
    const fetcher = vi.fn().mockResolvedValue(new Response('provider secret details', { status }));
    const provider = new SupabaseAuthRepository(config, fetcher as unknown as typeof fetch);
    await expect(provider.getPrincipal('access-token')).resolves.toEqual(expected);
  });

  it('fails closed on malformed successful responses and network errors', async () => {
    const malformed = new SupabaseAuthRepository(
      config,
      vi.fn().mockResolvedValue(new Response('{}', { status: 200 })) as unknown as typeof fetch,
    );
    await expect(malformed.refreshSession('refresh-token')).resolves.toEqual({
      status: 'unavailable',
    });

    const offline = new SupabaseAuthRepository(
      config,
      vi.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch,
    );
    await expect(offline.getPrincipal('access-token')).resolves.toEqual({ status: 'unavailable' });
  });

  it('rejects provider emails that violate the public contract', async () => {
    const provider = new SupabaseAuthRepository(
      config,
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ id: principal.id, email: 'a@' }), { status: 200 }),
        ) as unknown as typeof fetch,
    );
    await expect(provider.getPrincipal('access-token')).resolves.toEqual({
      status: 'unavailable',
    });
  });
});

function createReplyRecorder(): { reply: FastifyReply; headers: Record<string, unknown> } {
  const headers: Record<string, unknown> = {};
  return {
    headers,
    reply: {
      header: vi.fn((name: string, value: unknown) => {
        headers[name] = value;
      }),
    } as unknown as FastifyReply,
  };
}
