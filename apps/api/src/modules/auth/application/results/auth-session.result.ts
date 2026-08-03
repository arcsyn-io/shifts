import type { AuthUser } from '@arcsyn-shift/contracts';

export interface AuthSessionResult {
  readonly user: AuthUser;
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly csrfToken: string;
}

export interface VerifiedAccessResult {
  readonly user: AuthUser;
  readonly familyId: string;
  readonly csrfHash: string;
}
