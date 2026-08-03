import { Inject, Injectable } from '@nestjs/common';
import type { AppLogger } from '@arcsyn-shift/observability';
import { AUTH_LOGGER } from '../../auth.tokens.js';
import { AuthRepository } from '../../repository/auth.repository.js';
import { AuthTokenService } from '../auth-token.service.js';
import type { LogoutCommand } from '../commands/logout.command.js';
import { parseRefreshToken } from '../refresh-token.js';

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(AuthRepository) private readonly repository: AuthRepository,
    @Inject(AuthTokenService) private readonly tokens: AuthTokenService,
    @Inject(AUTH_LOGGER) private readonly logger: AppLogger,
  ) {}

  async execute(command: LogoutCommand): Promise<void> {
    if (command.refreshToken) {
      const current = parseRefreshToken(command.refreshToken);
      if (current) {
        await this.repository.revokeRefreshFamily(
          current.id,
          this.tokens.hashOpaqueToken(command.refreshToken),
        );
      }
    } else if (command.accessToken) {
      const access = await this.tokens.verifyAccessToken(command.accessToken);
      if (access) await this.repository.revokeRefreshFamilyById(access.familyId);
    }

    this.logger.info(
      { event: 'auth.logout', result: 'completed', correlationId: command.correlationId },
      'Logout completed',
    );
  }
}
