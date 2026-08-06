import { AuthError } from '../../auth.error.js';
import type { AuthProviderPort } from '../auth-provider.js';
import type { BrowserSessionCredentials } from './get-session.use-case.js';

export class LogoutUseCase {
  constructor(private readonly provider: AuthProviderPort) {}

  async execute(credentials: BrowserSessionCredentials): Promise<void> {
    if (!credentials.accessToken) {
      if (!credentials.refreshToken) return;
      const refreshed = await this.provider.refreshSession(credentials.refreshToken);
      if (refreshed.status === 'unavailable') throw new AuthError('unavailable');
      if (refreshed.status === 'unauthorized') return;

      const signedOut = await this.provider.signOut(refreshed.value.accessToken);
      if (signedOut.status !== 'success') throw new AuthError('unavailable');
      return;
    }

    const signedOut = await this.provider.signOut(credentials.accessToken);
    if (signedOut.status === 'unavailable') throw new AuthError('unavailable');
    if (signedOut.status === 'success' || !credentials.refreshToken) return;

    const refreshed = await this.provider.refreshSession(credentials.refreshToken);
    if (refreshed.status === 'unavailable') throw new AuthError('unavailable');
    if (refreshed.status === 'unauthorized') return;

    const retried = await this.provider.signOut(refreshed.value.accessToken);
    if (retried.status !== 'success') throw new AuthError('unavailable');
  }
}
