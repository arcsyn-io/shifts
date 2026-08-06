export const AUTH_FETCH = Symbol('AUTH_FETCH');
export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');
export const SUPABASE_AUTH_CONFIG = Symbol('SUPABASE_AUTH_CONFIG');

export interface SupabaseAuthConfig {
  nodeEnvironment: 'development' | 'test' | 'production';
  supabaseUrl: string;
  supabasePublishableKey: string;
  webOrigin: string;
}

export type AuthRepository = AuthProviderPort;
import type { AuthProviderPort } from '../domain/auth-provider.js';
