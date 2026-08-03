import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { loadConfig } from '@arcsyn-shift/config';
import { createLogger } from '@arcsyn-shift/observability';
import { AuthTokenService } from './application/auth-token.service.js';
import { PasswordService } from './application/password.service.js';
import { LoginUseCase } from './application/use-cases/login.use-case.js';
import { LogoutUseCase } from './application/use-cases/logout.use-case.js';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token.use-case.js';
import { AUTH_CONFIG, AUTH_LOGGER } from './auth.tokens.js';
import { AuthController } from './presentation/http/auth.controller.js';
import { AuthGuard } from './presentation/http/auth.guard.js';
import { AuthRepository } from './repository/auth.repository.js';

@Module({
  controllers: [AuthController],
  providers: [
    { provide: AUTH_CONFIG, useFactory: loadConfig },
    { provide: AUTH_LOGGER, useFactory: () => createLogger(loadConfig().LOG_LEVEL) },
    AuthRepository,
    AuthTokenService,
    PasswordService,
    LoginUseCase,
    RefreshTokenUseCase,
    LogoutUseCase,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
