export type AuthErrorCode =
  'invalid_credentials' | 'rate_limited' | 'invalid_session' | 'refresh_replay';

export class AuthError extends Error {
  constructor(readonly code: AuthErrorCode) {
    super(code);
    this.name = 'AuthError';
  }
}
