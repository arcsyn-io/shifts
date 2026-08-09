import { Module } from '@nestjs/common';
import { loadConfig } from '@arcsyn-shift/config';
import { ApplicationContextAuthenticator } from '../../infrastructure/context/application-context.js';
import { ApplicationContextModule } from '../../infrastructure/context/application-context.module.js';
import {
  AUTH_CONFIG,
  GET_SESSION_USE_CASE,
  LOGIN_USE_CASE,
  LOGOUT_USE_CASE,
  type AuthConfig,
} from './auth.tokens.js';
import type { AuthProviderPort } from './domain/auth-provider.js';
import { GetSessionUseCase } from './domain/use-cases/get-session.use-case.js';
import { LoginUseCase } from './domain/use-cases/login.use-case.js';
import { LogoutUseCase } from './domain/use-cases/logout.use-case.js';
import { AuthController } from './presentation/http/auth.controller.js';
import { BffMutationGuard, BffSessionGuard } from './presentation/http/guards/bff-session.guard.js';
import { AUTH_FETCH, AUTH_REPOSITORY, SUPABASE_AUTH_CONFIG } from './repository/auth.repository.js';
import { SupabaseAuthRepository } from './repository/supabase-auth.repository.js';

function loadAuthConfig(): AuthConfig {
  const config = loadConfig();
  if (!config.SUPABASE_URL || !config.SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      'Invalid auth configuration: SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required',
    );
  }
  return {
    nodeEnvironment: config.NODE_ENV,
    supabaseUrl: config.SUPABASE_URL,
    supabasePublishableKey: config.SUPABASE_PUBLISHABLE_KEY,
    webOrigin: new URL(config.WEB_URL).origin,
  };
}

@Module({
  imports: [ApplicationContextModule],
  controllers: [AuthController],
  providers: [
    { provide: AUTH_CONFIG, useFactory: loadAuthConfig },
    { provide: SUPABASE_AUTH_CONFIG, useFactory: loadAuthConfig },
    { provide: AUTH_FETCH, useValue: globalThis.fetch.bind(globalThis) },
    { provide: AUTH_REPOSITORY, useClass: SupabaseAuthRepository },
    ApplicationContextAuthenticator,
    BffSessionGuard,
    BffMutationGuard,
    {
      provide: LOGIN_USE_CASE,
      useFactory: (provider: AuthProviderPort) => new LoginUseCase(provider),
      inject: [AUTH_REPOSITORY],
    },
    {
      provide: GET_SESSION_USE_CASE,
      useFactory: (provider: AuthProviderPort) => new GetSessionUseCase(provider),
      inject: [AUTH_REPOSITORY],
    },
    {
      provide: LOGOUT_USE_CASE,
      useFactory: (provider: AuthProviderPort) => new LogoutUseCase(provider),
      inject: [AUTH_REPOSITORY],
    },
  ],
  exports: [
    AUTH_CONFIG,
    GET_SESSION_USE_CASE,
    ApplicationContextAuthenticator,
    BffSessionGuard,
    BffMutationGuard,
  ],
})
export class AuthModule {}
