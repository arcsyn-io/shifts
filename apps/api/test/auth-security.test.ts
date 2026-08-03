import 'reflect-metadata';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { loadConfig, type AppConfig } from '@arcsyn-shift/config';
import type { AppLogger } from '@arcsyn-shift/observability';
import { SignJWT } from 'jose';
import { describe, expect, it, vi } from 'vitest';
import { AuthTokenService } from '../src/modules/auth/application/auth-token.service.js';
import type { AuthService } from '../src/modules/auth/application/auth.service.js';
import { AuthController } from '../src/modules/auth/presentation/http/auth.controller.js';
import {
  AuthGuard,
  type AuthenticatedRequest,
} from '../src/modules/auth/presentation/http/auth.guard.js';
import {
  AUTH_PUBLIC_METADATA,
  AUTH_REQUIRE_CSRF_METADATA,
} from '../src/modules/auth/presentation/http/auth.metadata.js';
import {
  clearSessionCookies,
  createSessionCookies,
  getAuthCookieNames,
  parseCookies,
} from '../src/modules/auth/presentation/http/auth.cookies.js';

const HEADERS_METADATA = '__headers__';

const createConfig = (nodeEnvironment: 'development' | 'test' | 'production' = 'test') =>
  loadConfig({
    NODE_ENV: nodeEnvironment,
    DATABASE_URL: 'postgresql://application:password@localhost:5432/db',
    WEB_URL: 'http://localhost:5173',
    API_URL: 'http://localhost:3000',
    AUTH_JWT_SECRET: 'lgbPzYSIrOguUZ8nd5yR6wgNd2M8465pNTf7oZ-0aas',
    AUTH_RATE_LIMIT_SECRET: '3b1hfyM51LD-Zz7WGJuzZeTrcJ6EnnLumtv6MFYdh3k',
  });

const createContext = (
  request: Record<string, unknown>,
  metadata: Record<string, boolean> = {},
): ExecutionContext => {
  const handler = () => undefined;
  for (const [key, value] of Object.entries(metadata)) Reflect.defineMetadata(key, value, handler);
  return {
    getType: () => 'http',
    getHandler: () => handler,
    getClass: () => class TestController {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
};

describe('auth JWT and cookie security', () => {
  it('signs and verifies only the expected JWT context', async () => {
    const service = new AuthTokenService(createConfig());
    const token = await service.signAccessToken({
      user: { id: '6aa5bbc6-4888-4b72-a2a7-37ca3bdb786f', email: 'user@example.com' },
      familyId: '5b80d5ce-730c-4776-abce-4db60676f803',
      csrfHash: service.hashOpaqueToken('csrf'),
    });

    await expect(service.verifyAccessToken(token)).resolves.toMatchObject({
      user: { email: 'user@example.com' },
      familyId: '5b80d5ce-730c-4776-abce-4db60676f803',
    });
    await expect(service.verifyAccessToken(`${token}tampered`)).resolves.toBeNull();
  });

  it('rejects JWTs signed with a different environment secret', async () => {
    const issuer = new AuthTokenService(createConfig());
    const verifier = new AuthTokenService(
      loadConfig({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://application:password@localhost:5432/db',
        WEB_URL: 'http://localhost:5173',
        API_URL: 'http://localhost:3000',
        AUTH_JWT_SECRET: 'o2GirN9S7_fB-4dbwDQGsUl2Dab_3PQfq6SDtRYbWu4',
        AUTH_RATE_LIMIT_SECRET: 'oQF7XO7jcqdta1q9xCHtfYhc-Bdbd6Bi69pMHjW5Ld0',
      }),
    );
    const token = await issuer.signAccessToken({
      user: { id: '6aa5bbc6-4888-4b72-a2a7-37ca3bdb786f', email: 'user@example.com' },
      familyId: '5b80d5ce-730c-4776-abce-4db60676f803',
      csrfHash: issuer.hashOpaqueToken('csrf'),
    });

    await expect(verifier.verifyAccessToken(token)).resolves.toBeNull();
  });

  it.each([
    ['wrong-issuer', 'arcsyn-shift-web', Math.floor(Date.now() / 1000) + 60],
    ['arcsyn-shift-api', 'wrong-audience', Math.floor(Date.now() / 1000) + 60],
    ['arcsyn-shift-api', 'arcsyn-shift-web', Math.floor(Date.now() / 1000) - 1],
  ])('rejects JWT context issuer=%s audience=%s exp=%s', async (issuer, audience, expiration) => {
    const config = createConfig();
    const verifier = new AuthTokenService(config);
    const token = await new SignJWT({
      email: 'user@example.com',
      sid: '5b80d5ce-730c-4776-abce-4db60676f803',
      csh: verifier.hashOpaqueToken('csrf'),
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject('6aa5bbc6-4888-4b72-a2a7-37ca3bdb786f')
      .setIssuedAt()
      .setExpirationTime(expiration)
      .sign(Buffer.from(config.AUTH_JWT_SECRET, 'base64url'));

    await expect(verifier.verifyAccessToken(token)).resolves.toBeNull();
  });

  it.each([
    [Math.floor(Date.now() / 1000) + 60, Math.floor(Date.now() / 1000) + 600],
    [Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000) + 601],
  ])('rejects invalid JWT temporal bounds iat=%s exp=%s', async (issuedAt, expiration) => {
    const config = createConfig();
    const verifier = new AuthTokenService(config);
    const token = await new SignJWT({
      email: 'user@example.com',
      sid: '5b80d5ce-730c-4776-abce-4db60676f803',
      csh: verifier.hashOpaqueToken('csrf'),
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer(config.AUTH_JWT_ISSUER)
      .setAudience(config.AUTH_JWT_AUDIENCE)
      .setSubject('6aa5bbc6-4888-4b72-a2a7-37ca3bdb786f')
      .setIssuedAt(issuedAt)
      .setExpirationTime(expiration)
      .sign(Buffer.from(config.AUTH_JWT_SECRET, 'base64url'));

    await expect(verifier.verifyAccessToken(token)).resolves.toBeNull();
  });

  it('creates a high-entropy opaque refresh token and deterministic SHA-256 hash', () => {
    const service = new AuthTokenService(createConfig());
    const refresh = service.createRefreshToken();

    expect(refresh.token).toMatch(/^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/);
    expect(refresh.hash).toHaveLength(64);
    expect(service.hashOpaqueToken(refresh.token)).toBe(refresh.hash);
  });

  it('uses the independent rate-limit secret instead of the JWT signing key', () => {
    const firstConfig = createConfig();
    const secondConfig = loadConfig({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://application:password@localhost:5432/db',
      WEB_URL: 'http://localhost:5173',
      API_URL: 'http://localhost:3000',
      AUTH_JWT_SECRET: 'o2GirN9S7_fB-4dbwDQGsUl2Dab_3PQfq6SDtRYbWu4',
      AUTH_RATE_LIMIT_SECRET: firstConfig.AUTH_RATE_LIMIT_SECRET,
    });

    expect(
      new AuthTokenService(firstConfig).createRateLimitKey('account', 'user@example.com'),
    ).toBe(new AuthTokenService(secondConfig).createRateLimitKey('account', 'user@example.com'));
  });

  it('uses host-prefixed secure cookies in production without exposing credentials', () => {
    const cookies = createSessionCookies(createConfig('production'), {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      csrfToken: 'csrf-token',
    });

    expect(cookies[0]).toContain('__Host-arcsyn_access=access-token');
    expect(cookies[1]).toContain('__Host-arcsyn_refresh=refresh-token');
    expect(cookies[2]).toContain('__Host-arcsyn_csrf=csrf-token');
    for (const cookie of cookies) {
      expect(cookie).toContain('Secure');
      expect(cookie).toContain('Path=/');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).not.toContain('Domain=');
    }
    expect(cookies[0]).toContain('HttpOnly');
    expect(cookies[1]).toContain('HttpOnly');
    expect(cookies[2]).not.toContain('HttpOnly');
  });

  it('uses non-prefixed cookies for local HTTP and clears the same names', () => {
    const config = createConfig('development');
    expect(getAuthCookieNames(config)).toEqual({
      access: 'arcsyn_access',
      refresh: 'arcsyn_refresh',
      csrf: 'arcsyn_csrf',
    });
    expect(clearSessionCookies(config)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('arcsyn_access=; Path=/; Max-Age=0'),
        expect.stringContaining('arcsyn_refresh=; Path=/; Max-Age=0'),
        expect.stringContaining('arcsyn_csrf=; Path=/; Max-Age=0'),
      ]),
    );
  });

  it('keeps auth responses private and non-cacheable', () => {
    for (const method of ['login', 'session', 'refresh', 'logout'] as const) {
      expect(
        Reflect.getMetadata(HEADERS_METADATA, AuthController.prototype[method]),
      ).toContainEqual({ name: 'Cache-Control', value: 'private, no-store' });
    }
  });

  it('revokes an identifiable refresh on logout even when CSRF is absent', async () => {
    const authService = {
      logout: vi.fn().mockResolvedValue(undefined),
      logoutByAccessToken: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuthService;
    const controller = new AuthController(authService, createConfig());
    const reply = { header: vi.fn() };

    await controller.logout(
      {
        id: 'request-logout-refresh',
        headers: { cookie: 'arcsyn_refresh=refresh-token' },
      } as unknown as AuthenticatedRequest,
      reply as never,
    );

    expect(authService.logout).toHaveBeenCalledWith({
      refreshToken: 'refresh-token',
      correlationId: 'request-logout-refresh',
    });
    expect(reply.header).toHaveBeenCalledWith(
      'set-cookie',
      expect.arrayContaining([expect.stringContaining('arcsyn_refresh=;')]),
    );
  });

  it('falls back to a valid access cookie family when logout has no refresh cookie', async () => {
    const authService = {
      logout: vi.fn().mockResolvedValue(undefined),
      logoutByAccessToken: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuthService;
    const controller = new AuthController(authService, createConfig());
    const reply = { header: vi.fn() };

    await controller.logout(
      {
        id: 'request-logout-access',
        headers: { cookie: 'arcsyn_access=access-token' },
      } as unknown as AuthenticatedRequest,
      reply as never,
    );

    expect(authService.logout).not.toHaveBeenCalled();
    expect(authService.logoutByAccessToken).toHaveBeenCalledWith(
      'access-token',
      'request-logout-access',
    );
    expect(reply.header).toHaveBeenCalledWith(
      'set-cookie',
      expect.arrayContaining([expect.stringContaining('arcsyn_access=;')]),
    );
  });

  it('parses the first cookie value to resist duplicate cookie shadowing', () => {
    expect(parseCookies('arcsyn_access=first; arcsyn_access=second').arcsyn_access).toBe('first');
  });
});

describe('global auth guard', () => {
  const createGuard = (
    config: AppConfig = createConfig(),
    logger = { warn: vi.fn() } as unknown as AppLogger,
  ) => {
    const authService = {
      verifyAccessToken: vi.fn().mockResolvedValue(null),
      csrfMatchesAccess: vi.fn().mockReturnValue(false),
    } as unknown as AuthService;
    return new AuthGuard(new Reflector(), authService, config, logger);
  };

  it('rejects Bearer authentication even on an explicitly public route', async () => {
    const context = createContext(
      { method: 'GET', headers: { authorization: 'Bearer jwt' }, query: {} },
      { [AUTH_PUBLIC_METADATA]: true },
    );
    await expect(createGuard().canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a raw JWT in Authorization without a Bearer prefix', async () => {
    const context = createContext(
      {
        method: 'GET',
        headers: { authorization: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.signature' },
        query: {},
      },
      { [AUTH_PUBLIC_METADATA]: true },
    );
    await expect(createGuard().canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('logs transport rejection with correlation and no credential value', async () => {
    const logger = { warn: vi.fn() } as unknown as AppLogger;
    const context = createContext(
      {
        id: 'request-transport',
        method: 'GET',
        headers: { authorization: 'raw-secret-value' },
        query: {},
      },
      { [AUTH_PUBLIC_METADATA]: true },
    );

    await expect(createGuard(createConfig(), logger).canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(logger.warn).toHaveBeenCalledWith(
      {
        event: 'auth.transport',
        result: 'rejected',
        reason: 'authorization_header',
        correlationId: 'request-transport',
      },
      'Authentication request rejected',
    );
    expect(JSON.stringify(vi.mocked(logger.warn).mock.calls)).not.toContain('raw-secret-value');
  });

  it('rejects a JWT-like value under an unrelated query key', async () => {
    const context = createContext(
      {
        method: 'GET',
        headers: {},
        query: { value: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.signature' },
      },
      { [AUTH_PUBLIC_METADATA]: true },
    );
    await expect(createGuard().canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects nested credential keys and JWT-like values in body arrays', async () => {
    const nestedKeyContext = createContext(
      {
        method: 'POST',
        headers: { origin: 'http://localhost:5173' },
        query: {},
        body: { payload: { session: { access_token: 'credential' } } },
      },
      { [AUTH_PUBLIC_METADATA]: true },
    );
    const nestedValueContext = createContext(
      {
        method: 'POST',
        headers: { origin: 'http://localhost:5173' },
        query: {},
        body: { payload: [{ value: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.signature' }] },
      },
      { [AUTH_PUBLIC_METADATA]: true },
    );

    await expect(createGuard().canActivate(nestedKeyContext)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(createGuard().canActivate(nestedValueContext)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('fails closed when credential inspection exceeds the safe depth', async () => {
    const context = createContext(
      {
        method: 'GET',
        headers: {},
        query: { a: { b: { c: { d: { e: { f: { g: 'value' } } } } } } },
      },
      { [AUTH_PUBLIC_METADATA]: true },
    );
    await expect(createGuard().canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('requires the exact configured Origin on login', async () => {
    const logger = { warn: vi.fn() } as unknown as AppLogger;
    const context = createContext(
      {
        id: 'request-origin',
        method: 'POST',
        headers: { origin: 'https://evil.example' },
        query: {},
        body: {},
      },
      { [AUTH_PUBLIC_METADATA]: true },
    );
    await expect(createGuard(createConfig(), logger).canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(logger.warn).toHaveBeenCalledWith(
      {
        event: 'auth.origin',
        result: 'rejected',
        reason: 'origin_mismatch',
        correlationId: 'request-origin',
      },
      'Authentication request rejected',
    );
  });

  it('allows login from the configured Origin without a pre-existing CSRF token', async () => {
    const context = createContext(
      { method: 'POST', headers: { origin: 'http://localhost:5173' }, query: {}, body: {} },
      { [AUTH_PUBLIC_METADATA]: true },
    );
    await expect(createGuard().canActivate(context)).resolves.toBe(true);
  });

  it('requires matching CSRF cookie and header on refresh', async () => {
    const logger = { warn: vi.fn() } as unknown as AppLogger;
    const context = createContext(
      {
        id: 'request-csrf',
        method: 'POST',
        headers: { origin: 'http://localhost:5173', cookie: 'arcsyn_csrf=csrf' },
        query: {},
        body: {},
      },
      { [AUTH_PUBLIC_METADATA]: true, [AUTH_REQUIRE_CSRF_METADATA]: true },
    );
    await expect(createGuard(createConfig(), logger).canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(logger.warn).toHaveBeenCalledWith(
      {
        event: 'auth.csrf',
        result: 'rejected',
        reason: 'double_submit_mismatch',
        correlationId: 'request-csrf',
      },
      'Authentication request rejected',
    );
  });
});
