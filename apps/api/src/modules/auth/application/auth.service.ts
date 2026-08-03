import { Inject, Injectable } from '@nestjs/common';
import type { AppConfig } from '@arcsyn-shift/config';
import type { AuthSessionResponse } from '@arcsyn-shift/contracts';
import type { AppLogger } from '@arcsyn-shift/observability';
import { AUTH_CONFIG, AUTH_LOGGER } from '../auth.tokens.js';
import { AuthRepository } from '../repository/auth.repository.js';
import { AuthTokenService, REFRESH_TOKEN_MILLISECONDS } from './auth-token.service.js';
import type { LoginCommand } from './commands/login.command.js';
import type { LogoutCommand } from './commands/logout.command.js';
import type { RefreshSessionCommand } from './commands/refresh-session.command.js';
import { PasswordService } from './password.service.js';
import type { AuthSessionResult, VerifiedAccessResult } from './results/auth-session.result.js';

const REFRESH_TOKEN_PATTERN =
  /^(?<id>[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(?<secret>[A-Za-z0-9_-]{43})$/i;

export type AuthErrorCode =
  'invalid_credentials' | 'rate_limited' | 'invalid_session' | 'refresh_replay';

export class AuthError extends Error {
  constructor(readonly code: AuthErrorCode) {
    super(code);
    this.name = 'AuthError';
  }
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(AuthRepository) private readonly repository: AuthRepository,
    @Inject(AuthTokenService) private readonly tokens: AuthTokenService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(AUTH_CONFIG) private readonly config: AppConfig,
    @Inject(AUTH_LOGGER) private readonly logger: AppLogger,
  ) {}

  async login(command: LoginCommand): Promise<AuthSessionResult> {
    const accountKey = this.tokens.createRateLimitKey('account', command.email);
    const originKey = this.tokens.createRateLimitKey('origin', command.clientAddress);
    const admitted = await this.repository.admitRateLimitAttempts(
      [
        {
          scope: 'login_account',
          keyHash: accountKey,
          maximumAttempts: this.config.AUTH_LOGIN_ACCOUNT_MAX_ATTEMPTS,
        },
        {
          scope: 'login_origin',
          keyHash: originKey,
          maximumAttempts: this.config.AUTH_LOGIN_ORIGIN_MAX_ATTEMPTS,
        },
      ],
      this.config.AUTH_LOGIN_WINDOW_SECONDS,
      this.config.AUTH_LOGIN_BLOCK_SECONDS,
    );
    if (!admitted) {
      this.logger.warn(
        { event: 'auth.login', result: 'rate_limited', correlationId: command.correlationId },
        'Login rate limited',
      );
      throw new AuthError('rate_limited');
    }

    const user = await this.repository.findUserByEmail(command.email);
    const credentialsAreValid = await this.passwords.verify(user?.passwordHash, command.password);
    if (!user || !user.isActive || !credentialsAreValid) {
      this.logger.warn(
        { event: 'auth.login', result: 'rejected', correlationId: command.correlationId },
        'Login rejected',
      );
      throw new AuthError('invalid_credentials');
    }

    await this.repository.clearRateLimit('login_account', accountKey);
    const session = await this.createSession(user);
    this.logger.info(
      {
        event: 'auth.login',
        result: 'succeeded',
        userId: user.id,
        correlationId: command.correlationId,
      },
      'Login succeeded',
    );
    return session;
  }

  async refresh(command: RefreshSessionCommand): Promise<AuthSessionResult> {
    const rateLimitKey = this.tokens.createRateLimitKey('refresh-origin', command.clientAddress);
    const admitted = await this.repository.admitRateLimitAttempts(
      [
        {
          scope: 'refresh_origin',
          keyHash: rateLimitKey,
          maximumAttempts: this.config.AUTH_REFRESH_ORIGIN_MAX_ATTEMPTS,
        },
      ],
      this.config.AUTH_LOGIN_WINDOW_SECONDS,
      this.config.AUTH_LOGIN_BLOCK_SECONDS,
    );
    if (!admitted) {
      this.logger.warn(
        { event: 'auth.refresh', result: 'rate_limited', correlationId: command.correlationId },
        'Refresh rate limited',
      );
      throw new AuthError('rate_limited');
    }
    const current = this.parseRefreshToken(command.refreshToken);
    if (!current) {
      this.logger.warn(
        { event: 'auth.refresh', result: 'rejected', correlationId: command.correlationId },
        'Refresh rejected',
      );
      throw new AuthError('invalid_session');
    }
    const next = this.tokens.createRefreshToken();
    const csrfHash = this.tokens.hashOpaqueToken(command.csrfToken);
    const rotation = await this.repository.rotateRefreshSession({
      tokenId: current.id,
      tokenHash: this.tokens.hashOpaqueToken(command.refreshToken),
      csrfHash,
      nextTokenId: next.id,
      nextTokenHash: next.hash,
      nextExpiresAt: new Date(Date.now() + REFRESH_TOKEN_MILLISECONDS),
    });
    if (rotation.status === 'replay') {
      this.logger.warn(
        { event: 'auth.refresh', result: 'replay', correlationId: command.correlationId },
        'Refresh replay detected',
      );
      throw new AuthError('refresh_replay');
    }
    if (rotation.status === 'invalid') {
      this.logger.warn(
        { event: 'auth.refresh', result: 'rejected', correlationId: command.correlationId },
        'Refresh rejected',
      );
      throw new AuthError('invalid_session');
    }
    if (rotation.status !== 'rotated') throw new AuthError('invalid_session');

    const accessToken = await this.tokens.signAccessToken({
      user: rotation.user,
      familyId: rotation.familyId,
      csrfHash,
    });
    this.logger.info(
      {
        event: 'auth.refresh',
        result: 'succeeded',
        userId: rotation.user.id,
        correlationId: command.correlationId,
      },
      'Refresh succeeded',
    );
    return {
      user: rotation.user,
      accessToken,
      refreshToken: next.token,
      csrfToken: command.csrfToken,
    };
  }

  async logout(command: LogoutCommand): Promise<void> {
    const current = this.parseRefreshToken(command.refreshToken);
    if (!current) {
      this.logger.info(
        { event: 'auth.logout', result: 'completed', correlationId: command.correlationId },
        'Logout completed',
      );
      return;
    }
    await this.repository.revokeRefreshFamily(
      current.id,
      this.tokens.hashOpaqueToken(command.refreshToken),
    );
    this.logger.info(
      { event: 'auth.logout', result: 'completed', correlationId: command.correlationId },
      'Logout completed',
    );
  }

  async logoutByAccessToken(accessToken: string, correlationId: string): Promise<void> {
    const access = await this.tokens.verifyAccessToken(accessToken);
    if (access) await this.repository.revokeRefreshFamilyById(access.familyId);
    this.logger.info(
      { event: 'auth.logout', result: 'completed', correlationId },
      'Logout completed',
    );
  }

  async verifyAccessToken(accessToken: string): Promise<VerifiedAccessResult | null> {
    return this.tokens.verifyAccessToken(accessToken);
  }

  csrfMatchesAccess(csrfToken: string, access: VerifiedAccessResult): boolean {
    return this.tokens.hashesEqual(this.tokens.hashOpaqueToken(csrfToken), access.csrfHash);
  }

  toResponse(
    session: AuthSessionResult | VerifiedAccessResult,
    csrfToken: string,
  ): AuthSessionResponse {
    return { authenticated: true, user: session.user, csrfToken };
  }

  private async createSession(user: { id: string; email: string }): Promise<AuthSessionResult> {
    const refresh = this.tokens.createRefreshToken();
    const csrf = this.tokens.createCsrfToken();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MILLISECONDS);
    const familyId = await this.repository.createRefreshSession({
      userId: user.id,
      tokenId: refresh.id,
      tokenHash: refresh.hash,
      csrfHash: csrf.hash,
      expiresAt,
    });
    const accessToken = await this.tokens.signAccessToken({
      user,
      familyId,
      csrfHash: csrf.hash,
    });
    return {
      user,
      accessToken,
      refreshToken: refresh.token,
      csrfToken: csrf.token,
    };
  }

  private parseRefreshToken(token: string): { id: string } | null {
    const match = REFRESH_TOKEN_PATTERN.exec(token);
    return match?.groups?.id ? { id: match.groups.id } : null;
  }
}
