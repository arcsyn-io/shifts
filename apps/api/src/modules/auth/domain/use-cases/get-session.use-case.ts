import type { AuthSessionResponse } from '@arcsyn-shift/contracts';
import { AuthError } from '../../auth.error.js';
import type { AuthProviderPort, ProviderSession, PublicPrincipal } from '../auth-provider.js';

export interface BrowserSessionCredentials {
  accessToken?: string;
  refreshToken?: string;
  allowRefresh?: boolean;
}

export interface AuthenticatedSession {
  response: AuthSessionResponse;
  renewedSession?: ProviderSession;
}

export class GetSessionUseCase {
  constructor(private readonly provider: AuthProviderPort) {}

  async execute(credentials: BrowserSessionCredentials): Promise<AuthenticatedSession> {
    if (credentials.accessToken) {
      const principal = await this.provider.getPrincipal(credentials.accessToken);
      if (principal.status === 'success') return { response: this.toResponse(principal.value) };
      if (principal.status === 'unavailable') throw new AuthError('unavailable');
    }

    if (!credentials.refreshToken) throw new AuthError('invalid_session');
    if (!credentials.allowRefresh) throw new AuthError('forbidden');

    const refreshed = await this.provider.refreshSession(credentials.refreshToken);
    if (refreshed.status === 'success') {
      return {
        response: this.toResponse(refreshed.value.principal),
        renewedSession: refreshed.value,
      };
    }
    if (refreshed.status === 'unauthorized') throw new AuthError('invalid_session');
    throw new AuthError('unavailable');
  }

  private toResponse(principal: PublicPrincipal): AuthSessionResponse {
    return { principal: { id: principal.id, email: principal.email } };
  }
}
