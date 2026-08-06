import { Inject, Injectable } from '@nestjs/common';
import { authSessionResponseSchema } from '@arcsyn-shift/contracts';
import {
  AUTH_FETCH,
  SUPABASE_AUTH_CONFIG,
  type AuthRepository,
  type SupabaseAuthConfig,
} from './auth.repository.js';
import type {
  AuthProviderResponse,
  ProviderSession,
  PublicPrincipal,
} from '../domain/auth-provider.js';

type Fetch = typeof globalThis.fetch;

const MAX_TOKEN_LENGTH = 32_768;
const REQUEST_TIMEOUT_MS = 5_000;

@Injectable()
export class SupabaseAuthRepository implements AuthRepository {
  constructor(
    @Inject(SUPABASE_AUTH_CONFIG) private readonly config: SupabaseAuthConfig,
    @Inject(AUTH_FETCH) private readonly fetcher: Fetch,
  ) {}

  async signIn(email: string, password: string): Promise<AuthProviderResponse<ProviderSession>> {
    return this.requestSession('password', { email, password });
  }

  async refreshSession(refreshToken: string): Promise<AuthProviderResponse<ProviderSession>> {
    return this.requestSession('refresh_token', { refresh_token: refreshToken });
  }

  async getPrincipal(accessToken: string): Promise<AuthProviderResponse<PublicPrincipal>> {
    const response = await this.request('/auth/v1/user', {
      method: 'GET',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (response.status !== 'success') return response;

    const body = await this.readJson(response.value);
    const principal = toPrincipal(body);
    return principal ? { status: 'success', value: principal } : { status: 'unavailable' };
  }

  async signOut(accessToken: string): Promise<AuthProviderResponse<void>> {
    const response = await this.request('/auth/v1/logout?scope=local', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (response.status !== 'success') return response;
    return { status: 'success', value: undefined };
  }

  private async requestSession(
    grantType: 'password' | 'refresh_token',
    body: Record<string, string>,
  ): Promise<AuthProviderResponse<ProviderSession>> {
    const response = await this.request(`/auth/v1/token?grant_type=${grantType}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (response.status !== 'success') return response;

    const json = await this.readJson(response.value);
    const session = toProviderSession(json);
    return session ? { status: 'success', value: session } : { status: 'unavailable' };
  }

  private async request(path: string, init: RequestInit): Promise<AuthProviderResponse<Response>> {
    let response: Response;
    try {
      response = await this.fetcher(new URL(path, this.config.supabaseUrl), {
        ...init,
        headers: {
          apikey: this.config.supabasePublishableKey,
          ...init.headers,
        },
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      return { status: 'unavailable' };
    }

    if (response.ok) return { status: 'success', value: response };
    if ([400, 401, 403].includes(response.status)) return { status: 'unauthorized' };
    return { status: 'unavailable' };
  }

  private async readJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }
}

function toPrincipal(value: unknown): PublicPrincipal | undefined {
  if (!isRecord(value)) return undefined;
  const { id, email } = value;
  const result = authSessionResponseSchema.safeParse({ principal: { id, email } });
  return result.success ? result.data.principal : undefined;
}

function toProviderSession(value: unknown): ProviderSession | undefined {
  if (!isRecord(value)) return undefined;
  const principal = toPrincipal(value.user);
  const accessToken = value.access_token;
  const refreshToken = value.refresh_token;
  const expiresIn = value.expires_in;
  if (
    !principal ||
    !isBoundedToken(accessToken) ||
    !isBoundedToken(refreshToken) ||
    typeof expiresIn !== 'number' ||
    !Number.isInteger(expiresIn) ||
    expiresIn < 1 ||
    expiresIn > 86_400
  ) {
    return undefined;
  }
  return { principal, accessToken, refreshToken, expiresIn };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBoundedToken(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_TOKEN_LENGTH;
}
