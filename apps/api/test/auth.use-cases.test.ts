import { describe, expect, it, vi } from 'vitest';
import { AuthError } from '../src/modules/auth/auth.error.js';
import type { AuthProviderPort } from '../src/modules/auth/domain/auth-provider.js';
import { GetSessionUseCase } from '../src/modules/auth/domain/use-cases/get-session.use-case.js';
import { LoginUseCase } from '../src/modules/auth/domain/use-cases/login.use-case.js';
import { LogoutUseCase } from '../src/modules/auth/domain/use-cases/logout.use-case.js';

const principal = {
  id: '6aa5bbc6-4888-4b72-a2a7-37ca3bdb786f',
  email: 'user@example.com',
};
const providerSession = {
  principal,
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresIn: 3600,
};

function createProvider(): AuthProviderPort {
  return {
    signIn: vi.fn(),
    getPrincipal: vi.fn(),
    refreshSession: vi.fn(),
    signOut: vi.fn(),
  };
}

describe('auth use cases', () => {
  it('logs in through the provider port', async () => {
    const provider = createProvider();
    vi.mocked(provider.signIn).mockResolvedValue({ status: 'success', value: providerSession });
    await expect(
      new LoginUseCase(provider).execute({ email: principal.email, password: 'secret' }),
    ).resolves.toEqual(providerSession);
  });

  it('maps credential failures uniformly', async () => {
    const provider = createProvider();
    vi.mocked(provider.signIn).mockResolvedValue({ status: 'unauthorized' });
    await expect(
      new LoginUseCase(provider).execute({ email: 'missing@example.com', password: 'wrong' }),
    ).rejects.toEqual(new AuthError('invalid_credentials'));
  });

  it('validates access without refreshing a valid session', async () => {
    const provider = createProvider();
    vi.mocked(provider.getPrincipal).mockResolvedValue({ status: 'success', value: principal });
    await expect(
      new GetSessionUseCase(provider).execute({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      }),
    ).resolves.toEqual({ response: { principal } });
    expect(provider.refreshSession).not.toHaveBeenCalled();
  });

  it('renews expired access through refresh', async () => {
    const provider = createProvider();
    vi.mocked(provider.getPrincipal).mockResolvedValue({ status: 'unauthorized' });
    vi.mocked(provider.refreshSession).mockResolvedValue({
      status: 'success',
      value: providerSession,
    });
    await expect(
      new GetSessionUseCase(provider).execute({
        accessToken: 'expired-access',
        refreshToken: 'refresh-token',
        allowRefresh: true,
      }),
    ).resolves.toEqual({ response: { principal }, renewedSession: providerSession });
  });

  it('rejects refresh when the request origin is not trusted', async () => {
    const provider = createProvider();
    await expect(
      new GetSessionUseCase(provider).execute({ refreshToken: 'refresh-token' }),
    ).rejects.toEqual(new AuthError('forbidden'));
    expect(provider.refreshSession).not.toHaveBeenCalled();
  });

  it('distinguishes unavailable Auth from an invalid session', async () => {
    const unavailable = createProvider();
    vi.mocked(unavailable.getPrincipal).mockResolvedValue({ status: 'unavailable' });
    await expect(
      new GetSessionUseCase(unavailable).execute({ accessToken: 'access-token' }),
    ).rejects.toEqual(new AuthError('unavailable'));
    await expect(new GetSessionUseCase(createProvider()).execute({})).rejects.toEqual(
      new AuthError('invalid_session'),
    );
  });

  it('keeps logout idempotent without cookies', async () => {
    const provider = createProvider();
    await expect(new LogoutUseCase(provider).execute({})).resolves.toBeUndefined();
    expect(provider.signOut).not.toHaveBeenCalled();
  });

  it('fails safely when a refreshed session cannot be revoked', async () => {
    const provider = createProvider();
    vi.mocked(provider.refreshSession).mockResolvedValue({
      status: 'success',
      value: providerSession,
    });
    vi.mocked(provider.signOut).mockResolvedValue({ status: 'unauthorized' });
    await expect(
      new LogoutUseCase(provider).execute({ refreshToken: 'refresh-token' }),
    ).rejects.toEqual(new AuthError('unavailable'));
  });
});
