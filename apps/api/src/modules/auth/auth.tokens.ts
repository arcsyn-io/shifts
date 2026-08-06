import type { LoginRequest } from '@arcsyn-shift/contracts';
import type { ProviderSession } from './domain/auth-provider.js';
import type {
  AuthenticatedSession,
  BrowserSessionCredentials,
} from './domain/use-cases/get-session.use-case.js';

export const AUTH_CONFIG = Symbol('AUTH_CONFIG');
export const LOGIN_USE_CASE = Symbol('LOGIN_USE_CASE');
export const GET_SESSION_USE_CASE = Symbol('GET_SESSION_USE_CASE');
export const LOGOUT_USE_CASE = Symbol('LOGOUT_USE_CASE');

export interface AuthConfig {
  nodeEnvironment: 'development' | 'test' | 'production';
  supabaseUrl: string;
  supabasePublishableKey: string;
  webOrigin: string;
}

export interface LoginExecutor {
  execute(command: LoginRequest): Promise<ProviderSession>;
}

export interface GetSessionExecutor {
  execute(credentials: BrowserSessionCredentials): Promise<AuthenticatedSession>;
}

export interface LogoutExecutor {
  execute(credentials: BrowserSessionCredentials): Promise<void>;
}
