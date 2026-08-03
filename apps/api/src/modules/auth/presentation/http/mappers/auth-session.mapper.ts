import type { AuthSessionResponse } from '@arcsyn-shift/contracts';
import type {
  AuthSessionResult,
  VerifiedAccessResult,
} from '../../../application/results/auth-session.result.js';

export const toAuthSessionResponse = (
  session: AuthSessionResult | VerifiedAccessResult,
  csrfToken: string,
): AuthSessionResponse => ({ authenticated: true, user: session.user, csrfToken });
