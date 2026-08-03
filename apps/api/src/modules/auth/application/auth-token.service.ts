import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { AppConfig } from '@arcsyn-shift/config';
import { jwtVerify, SignJWT } from 'jose';
import { AUTH_CONFIG } from '../auth.tokens.js';
import type { VerifiedAccessResult } from './results/auth-session.result.js';

const ACCESS_TOKEN_SECONDS = 10 * 60;
const CLOCK_TOLERANCE_SECONDS = 5;
export const REFRESH_TOKEN_MILLISECONDS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthTokenService {
  private readonly secret: Uint8Array;
  private readonly rateLimitKey: Buffer;

  constructor(@Inject(AUTH_CONFIG) private readonly config: AppConfig) {
    this.secret = Buffer.from(config.AUTH_JWT_SECRET, 'base64url');
    this.rateLimitKey = Buffer.from(config.AUTH_RATE_LIMIT_SECRET, 'base64url');
  }

  async signAccessToken(input: VerifiedAccessResult): Promise<string> {
    return new SignJWT({
      email: input.user.email,
      sid: input.familyId,
      csh: input.csrfHash,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer(this.config.AUTH_JWT_ISSUER)
      .setAudience(this.config.AUTH_JWT_AUDIENCE)
      .setSubject(input.user.id)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TOKEN_SECONDS}s`)
      .sign(this.secret);
  }

  async verifyAccessToken(token: string): Promise<VerifiedAccessResult | null> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        algorithms: ['HS256'],
        issuer: this.config.AUTH_JWT_ISSUER,
        audience: this.config.AUTH_JWT_AUDIENCE,
        clockTolerance: CLOCK_TOLERANCE_SECONDS,
      });
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.email !== 'string' ||
        typeof payload.sid !== 'string' ||
        typeof payload.csh !== 'string' ||
        typeof payload.iat !== 'number' ||
        typeof payload.exp !== 'number'
      ) {
        return null;
      }
      const now = Math.floor(Date.now() / 1000);
      if (
        payload.iat > now ||
        payload.exp <= payload.iat ||
        payload.exp - payload.iat > ACCESS_TOKEN_SECONDS
      ) {
        return null;
      }
      return {
        user: { id: payload.sub, email: payload.email },
        familyId: payload.sid,
        csrfHash: payload.csh,
      };
    } catch {
      return null;
    }
  }

  createRefreshToken(): { id: string; token: string; hash: string } {
    const id = randomUUID();
    const token = `${id}.${randomBytes(32).toString('base64url')}`;
    return { id, token, hash: this.hashOpaqueToken(token) };
  }

  createCsrfToken(): { token: string; hash: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: this.hashOpaqueToken(token) };
  }

  hashOpaqueToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  hashesEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'utf8');
    const rightBuffer = Buffer.from(right, 'utf8');
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }

  createRateLimitKey(domain: 'account' | 'origin' | 'refresh-origin', value: string): string {
    return createHmac('sha256', this.rateLimitKey).update(`${domain}\0${value}`).digest('hex');
  }
}
