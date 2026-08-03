import { Inject, Injectable } from '@nestjs/common';
import type { AppConfig } from '@arcsyn-shift/config';
import type { AppLogger } from '@arcsyn-shift/observability';
import { AUTH_CONFIG, AUTH_LOGGER } from '../../auth.tokens.js';
import { AuthRepository } from '../../repository/auth.repository.js';
import { AuthError } from '../auth.error.js';
import { AuthTokenService, REFRESH_TOKEN_MILLISECONDS } from '../auth-token.service.js';
import type { RefreshSessionCommand } from '../commands/refresh-session.command.js';
import { parseRefreshToken } from '../refresh-token.js';
import type { AuthSessionResult } from '../results/auth-session.result.js';

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    @Inject(AuthRepository) private readonly repository: AuthRepository,
    @Inject(AuthTokenService) private readonly tokens: AuthTokenService,
    @Inject(AUTH_CONFIG) private readonly config: AppConfig,
    @Inject(AUTH_LOGGER) private readonly logger: AppLogger,
  ) {}

  async execute(command: RefreshSessionCommand): Promise<AuthSessionResult> {
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

    const current = parseRefreshToken(command.refreshToken);
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
}
