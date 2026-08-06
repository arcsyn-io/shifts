import type { LoginRequest } from '@arcsyn-shift/contracts';
import { AuthError } from '../../auth.error.js';
import type { AuthProviderPort, ProviderSession } from '../auth-provider.js';

export class LoginUseCase {
  constructor(private readonly provider: AuthProviderPort) {}

  async execute(command: LoginRequest): Promise<ProviderSession> {
    const result = await this.provider.signIn(command.email, command.password);
    if (result.status === 'success') return result.value;
    if (result.status === 'unauthorized') throw new AuthError('invalid_credentials');
    throw new AuthError('unavailable');
  }
}
