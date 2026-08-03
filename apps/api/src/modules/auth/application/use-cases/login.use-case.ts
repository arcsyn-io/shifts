import { Inject, Injectable } from '@nestjs/common';
import type { AppConfig } from '@arcsyn-shift/config';
import type { AppLogger } from '@arcsyn-shift/observability';
import { AUTH_CONFIG, AUTH_LOGGER } from '../../auth.tokens.js';
import { AuthRepository } from '../../repository/auth.repository.js';
import { AuthError } from '../auth.error.js';
import { AuthTokenService, REFRESH_TOKEN_MILLISECONDS } from '../auth-token.service.js';
import type { LoginCommand } from '../commands/login.command.js';
import { PasswordService } from '../password.service.js';
import type { AuthSessionResult } from '../results/auth-session.result.js';

const createSession = async (
  repository: AuthRepository,
  tokens: AuthTokenService,
  user: { id: string; email: string },
): Promise<AuthSessionResult> => {
  const refresh = tokens.createRefreshToken();
  const csrf = tokens.createCsrfToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MILLISECONDS);
  const familyId = await repository.createRefreshSession({
    userId: user.id,
    tokenId: refresh.id,
    tokenHash: refresh.hash,
    csrfHash: csrf.hash,
    expiresAt,
  });
  const accessToken = await tokens.signAccessToken({
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
};

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(AuthRepository) private readonly repository: AuthRepository,
    @Inject(AuthTokenService) private readonly tokens: AuthTokenService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(AUTH_CONFIG) private readonly config: AppConfig,
    @Inject(AUTH_LOGGER) private readonly logger: AppLogger,
  ) {}

  async execute(command: LoginCommand): Promise<AuthSessionResult> {
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
    const session = await createSession(this.repository, this.tokens, user);
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
}
