import type { AppConfig } from '@arcsyn-shift/config';
import type { AppLogger } from '@arcsyn-shift/observability';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthError } from '../src/modules/auth/application/auth.error.js';
import type { AuthTokenService } from '../src/modules/auth/application/auth-token.service.js';
import type { PasswordService } from '../src/modules/auth/application/password.service.js';
import { LoginUseCase } from '../src/modules/auth/application/use-cases/login.use-case.js';
import { LogoutUseCase } from '../src/modules/auth/application/use-cases/logout.use-case.js';
import { RefreshTokenUseCase } from '../src/modules/auth/application/use-cases/refresh-token.use-case.js';
import type { AuthRepository } from '../src/modules/auth/repository/auth.repository.js';

describe('auth use cases', () => {
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

  const createLoginUseCase = () =>
    new LoginUseCase(
      repository as unknown as AuthRepository,
      tokens as unknown as AuthTokenService,
      passwords as unknown as PasswordService,
      config,
      logger as unknown as AppLogger,
    );
  const createRefreshTokenUseCase = () =>
    new RefreshTokenUseCase(
      repository as unknown as AuthRepository,
      tokens as unknown as AuthTokenService,
      config,
      logger as unknown as AppLogger,
    );
  const createLogoutUseCase = () =>
    new LogoutUseCase(
      repository as unknown as AuthRepository,
      tokens as unknown as AuthTokenService,
      logger as unknown as AppLogger,
    );

  beforeEach(() => {
    vi.clearAllMocks();
    repository.admitRateLimitAttempts.mockResolvedValue(true);
    repository.clearRateLimit.mockResolvedValue(undefined);
    repository.createRefreshSession.mockResolvedValue('family-id');
  });

  it.each([
    ['LoginUseCase', LoginUseCase.prototype],
    ['RefreshTokenUseCase', RefreshTokenUseCase.prototype],
    ['LogoutUseCase', LogoutUseCase.prototype],
  ])('%s exposes only execute as a public prototype operation', (_name, prototype) => {
    expect(Object.getOwnPropertyNames(prototype)).toEqual(['constructor', 'execute']);
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
      createLoginUseCase().execute({
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
      createLoginUseCase().execute({
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
      createRefreshTokenUseCase().execute({
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
    expect(tokens.signAccessToken).not.toHaveBeenCalled();
  });

  it('rotates the refresh token and signs the renewed access session', async () => {
    const validRefresh =
      '96c948b4-f67a-47a5-a45b-02f03c7ed21f.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    tokens.createRefreshToken.mockReturnValue({
      id: 'next-id',
      token: 'next-refresh',
      hash: 'next-hash',
    });
    repository.rotateRefreshSession.mockResolvedValue({
      status: 'rotated',
      user: { id: 'user-id', email: 'user@example.com' },
      familyId: 'family-id',
    });

    await expect(
      createRefreshTokenUseCase().execute({
        refreshToken: validRefresh,
        csrfToken: 'csrf',
        clientAddress: '127.0.0.1',
        correlationId: 'request-refresh-success',
      }),
    ).resolves.toEqual({
      user: { id: 'user-id', email: 'user@example.com' },
      accessToken: 'access',
      refreshToken: 'next-refresh',
      csrfToken: 'csrf',
    });
    expect(repository.rotateRefreshSession).toHaveBeenCalledWith({
      tokenId: '96c948b4-f67a-47a5-a45b-02f03c7ed21f',
      tokenHash: `${validRefresh}-hash`,
      csrfHash: 'csrf-hash',
      nextTokenId: 'next-id',
      nextTokenHash: 'next-hash',
      nextExpiresAt: expect.any(Date),
    });
    expect(tokens.signAccessToken).toHaveBeenCalledWith({
      user: { id: 'user-id', email: 'user@example.com' },
      familyId: 'family-id',
      csrfHash: 'csrf-hash',
    });
    expect(logger.info).toHaveBeenCalledWith(
      {
        event: 'auth.refresh',
        result: 'succeeded',
        userId: 'user-id',
        correlationId: 'request-refresh-success',
      },
      'Refresh succeeded',
    );
  });

  it('rejects a malformed refresh token without rotating or signing JWT', async () => {
    await expect(
      createRefreshTokenUseCase().execute({
        refreshToken: 'malformed-refresh-token',
        csrfToken: 'csrf',
        clientAddress: '127.0.0.1',
        correlationId: 'request-refresh-invalid',
      }),
    ).rejects.toMatchObject({ code: 'invalid_session' } satisfies Partial<AuthError>);

    expect(repository.rotateRefreshSession).not.toHaveBeenCalled();
    expect(tokens.signAccessToken).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      {
        event: 'auth.refresh',
        result: 'rejected',
        correlationId: 'request-refresh-invalid',
      },
      'Refresh rejected',
    );
  });

  it('rejects a non-admitted refresh before rotating or signing JWT', async () => {
    repository.admitRateLimitAttempts.mockResolvedValue(false);

    await expect(
      createRefreshTokenUseCase().execute({
        refreshToken:
          '96c948b4-f67a-47a5-a45b-02f03c7ed21f.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        csrfToken: 'csrf',
        clientAddress: '127.0.0.1',
        correlationId: 'request-refresh-rate-limit',
      }),
    ).rejects.toMatchObject({ code: 'rate_limited' } satisfies Partial<AuthError>);

    expect(repository.rotateRefreshSession).not.toHaveBeenCalled();
    expect(tokens.signAccessToken).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      {
        event: 'auth.refresh',
        result: 'rate_limited',
        correlationId: 'request-refresh-rate-limit',
      },
      'Refresh rate limited',
    );
  });

  it('rejects a non-admitted login before loading or hashing credentials', async () => {
    repository.admitRateLimitAttempts.mockResolvedValue(false);

    await expect(
      createLoginUseCase().execute({
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

    await createLogoutUseCase().execute({
      accessToken: 'access-token',
      correlationId: 'request-5',
    });

    expect(repository.revokeRefreshFamilyById).toHaveBeenCalledWith('family-id');
    expect(logger.info).toHaveBeenCalledWith(
      { event: 'auth.logout', result: 'completed', correlationId: 'request-5' },
      'Logout completed',
    );
  });

  it('keeps access-token logout idempotent when the token is invalid', async () => {
    tokens.verifyAccessToken.mockResolvedValue(null);

    await createLogoutUseCase().execute({
      accessToken: 'invalid-access-token',
      correlationId: 'request-6',
    });

    expect(repository.revokeRefreshFamilyById).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledOnce();
  });

  it('prefers the refresh token and emits one completion event on logout', async () => {
    const refreshToken =
      '96c948b4-f67a-47a5-a45b-02f03c7ed21f.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

    await createLogoutUseCase().execute({
      refreshToken,
      accessToken: 'access-token',
      correlationId: 'request-7',
    });

    expect(repository.revokeRefreshFamily).toHaveBeenCalledWith(
      '96c948b4-f67a-47a5-a45b-02f03c7ed21f',
      `${refreshToken}-hash`,
    );
    expect(tokens.verifyAccessToken).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledOnce();
    expect(logger.info).toHaveBeenCalledWith(
      { event: 'auth.logout', result: 'completed', correlationId: 'request-7' },
      'Logout completed',
    );
  });
});
