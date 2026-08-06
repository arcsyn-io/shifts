export interface PublicPrincipal {
  id: string;
  email: string;
}

export interface ProviderSession {
  principal: PublicPrincipal;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export type AuthProviderResponse<T> =
  { status: 'success'; value: T } | { status: 'unauthorized' } | { status: 'unavailable' };

export interface AuthProviderPort {
  signIn(email: string, password: string): Promise<AuthProviderResponse<ProviderSession>>;
  getPrincipal(accessToken: string): Promise<AuthProviderResponse<PublicPrincipal>>;
  refreshSession(refreshToken: string): Promise<AuthProviderResponse<ProviderSession>>;
  signOut(accessToken: string): Promise<AuthProviderResponse<void>>;
}
