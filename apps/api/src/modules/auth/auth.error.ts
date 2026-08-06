export type AuthErrorKind = 'invalid_credentials' | 'invalid_session' | 'forbidden' | 'unavailable';

export class AuthError extends Error {
  constructor(readonly kind: AuthErrorKind) {
    super(kind);
    this.name = 'AuthError';
  }
}
