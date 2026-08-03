import type { AppConfig } from '@arcsyn-shift/config';
import type { AppLogger } from '@arcsyn-shift/observability';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthTokenService } from '../src/modules/auth/application/auth-token.service.js';
import { AuthError, AuthService } from '../src/modules/auth/application/auth.service.js';
import type { PasswordService } from '../src/modules/auth/application/password.service.js';
import type { AuthRepository } from '../src/modules/auth/repository/auth.repository.js';

describe('AuthService', () => {
  const repository = {
    admitRateLimitAttempts: vi.fn(),
    findUserByEmail: vi.fn(),
    clearRateLimit: vi.fn(),
    createRefreshSession: vi.fn(),
    rotateRefreshSession: vi.fn(),
    revokeRefreshFamily: vi.fn(),
    revokeRefreshFamilyById: vi.fn(),
    createUser: vi.fn(),
  };
  const tokens = {
    createRateLimitKey: vi.fn((domain: string) => `${domain}-key`),
    createRefreshToken: vi.fn(() => ({ id: 'token-id', token: 'refresh', hash: 'refresh-hash' })),
    createCsrfToken: vi.fn(() => ({ token: 'csrf', hash: 'csrf-hash' })),
    hashOpaqueToken: vi.fn((value: string) => `${value}-hash`),
    signAccessToken: vi.fn().mockResolvedValue('access'),
    verifyAccessToken: vi.fn(),
    hashesEqual: vi.fn(),
  };
  const passwords = { verify: vi.fn(), hash: vi.fn() };
  const logger = { info: vi.fn(), warn: vi.fn() };
  const config = {
    AUTH_LOGIN_ACCOUNT_MAX_ATTEMPTS: 5,
    AUTH_LOGIN_ORIGIN_MAX_ATTEMPTS: 30,
    AUTH_REFRESH_ORIGIN_MAX_ATTEMPTS: 60,
    AUTH_LOGIN_WINDOW_SECONDS: 900,
    AUTH_LOGIN_BLOCK_SECONDS: 900,
  } as AppConfig;

  const createService = () =>
    new AuthService(
      repository as unknown as AuthRepository,
      tokens as unknown as AuthTokenService,
      passwords as unknown as PasswordService,
      config,
      logger as unknown as AppLogger,
    );

  beforeEach(() => {
    vi.clearAllMocks();
    repository.admitRateLimitAttempts.mockResolvedValue(true);
    repository.clearRateLimit.mockResolvedValue(undefined);
    repository.createRefreshSession.mockResolvedValue('family-id');
  });

  it('returns the same generic error and records both buckets for an inactive account', async () => {
    repository.findUserByEmail.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      passwordHash: 'hash',
      isActive: false,
    });
    passwords.verify.mockResolvedValue(true);

    await expect(
      createService().login({
        email: 'user@example.com',
        password: 'password',
        clientAddress: '127.0.0.1',
        correlationId: 'request-1',
      }),
    ).rejects.toMatchObject({ code: 'invalid_credentials' } satisfies Partial<AuthError>);
    expect(repository.admitRateLimitAttempts).toHaveBeenCalledWith(
      [
        { scope: 'login_account', keyHash: 'account-key', maximumAttempts: 5 },
        { scope: 'login_origin', keyHash: 'origin-key', maximumAttempts: 30 },
      ],
      900,
      900,
    );
    expect(logger.warn).toHaveBeenCalledWith(
      { event: 'auth.login', result: 'rejected', correlationId: 'request-1' },
      'Login rejected',
    );
    expect(repository.createRefreshSession).not.toHaveBeenCalled();
  });

  it('creates a persisted refresh family before returning a successful login', async () => {
    repository.findUserByEmail.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      passwordHash: 'hash',
      isActive: true,
    });
    passwords.verify.mockResolvedValue(true);

    await expect(
      createService().login({
        email: 'user@example.com',
        password: 'password',
        clientAddress: '127.0.0.1',
        correlationId: 'request-2',
      }),
    ).resolves.toMatchObject({
      accessToken: 'access',
      refreshToken: 'refresh',
      csrfToken: 'csrf',
    });
    expect(repository.createRefreshSession).toHaveBeenCalledOnce();
    expect(tokens.signAccessToken).toHaveBeenCalledOnce();
    expect(repository.clearRateLimit).toHaveBeenCalledWith('login_account', 'account-key');
  });

  it('surfaces replay only after recording the persistent refresh rate limit', async () => {
    tokens.createRefreshToken.mockReturnValue({
      id: 'next-id',
      token: 'next-refresh',
      hash: 'next-hash',
    });
    repository.rotateRefreshSession.mockResolvedValue({ status: 'replay' });
    const validRefresh =
      '96c948b4-f67a-47a5-a45b-02f03c7ed21f.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

    await expect(
      createService().refresh({
        refreshToken: validRefresh,
        csrfToken: 'csrf',
        clientAddress: '127.0.0.1',
        correlationId: 'request-3',
      }),
    ).rejects.toMatchObject({ code: 'refresh_replay' } satisfies Partial<AuthError>);
    expect(repository.admitRateLimitAttempts).toHaveBeenCalledWith(
      [{ scope: 'refresh_origin', keyHash: 'refresh-origin-key', maximumAttempts: 60 }],
      900,
      900,
    );
    expect(logger.warn).toHaveBeenCalledWith(
      { event: 'auth.refresh', result: 'replay', correlationId: 'request-3' },
      'Refresh replay detected',
    );
  });

  it('rejects a non-admitted login before loading or hashing credentials', async () => {
    repository.admitRateLimitAttempts.mockResolvedValue(false);

    await expect(
      createService().login({
        email: 'user@example.com',
        password: 'password',
        clientAddress: '127.0.0.1',
        correlationId: 'request-4',
      }),
    ).rejects.toMatchObject({ code: 'rate_limited' } satisfies Partial<AuthError>);
    expect(repository.findUserByEmail).not.toHaveBeenCalled();
    expect(passwords.verify).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      { event: 'auth.login', result: 'rate_limited', correlationId: 'request-4' },
      'Login rate limited',
    );
  });

  it('revokes the family identified by a valid access token', async () => {
    tokens.verifyAccessToken.mockResolvedValue({
      user: { id: 'user-id', email: 'user@example.com' },
      familyId: 'family-id',
      csrfHash: 'csrf-hash',
    });

    await createService().logoutByAccessToken('access-token', 'request-5');

    expect(repository.revokeRefreshFamilyById).toHaveBeenCalledWith('family-id');
    expect(logger.info).toHaveBeenCalledWith(
      { event: 'auth.logout', result: 'completed', correlationId: 'request-5' },
      'Logout completed',
    );
  });

  it('keeps access-token logout idempotent when the token is invalid', async () => {
    tokens.verifyAccessToken.mockResolvedValue(null);

    await createService().logoutByAccessToken('invalid-access-token', 'request-6');

    expect(repository.revokeRefreshFamilyById).not.toHaveBeenCalled();
  });
});
