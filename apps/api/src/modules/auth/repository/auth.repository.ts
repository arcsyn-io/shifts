import { timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  authRateLimits,
  authRefreshTokenFamilies,
  authRefreshTokens,
  users,
  and,
  eq,
  sql,
  type Database,
} from '@arcsyn-shift/database';
import { DATABASE } from '../../../infrastructure/database/database.module.js';

export interface AuthUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
}

interface NewRefreshSession {
  userId: string;
  tokenId: string;
  tokenHash: string;
  csrfHash: string;
  expiresAt: Date;
}

interface RotateRefreshSession {
  tokenId: string;
  tokenHash: string;
  csrfHash: string;
  nextTokenId: string;
  nextTokenHash: string;
  nextExpiresAt: Date;
}

export type RefreshRotation =
  | { status: 'rotated'; user: { id: string; email: string }; familyId: string }
  | { status: 'invalid' | 'replay' };

export type AuthRateLimitScope = 'login_account' | 'login_origin' | 'refresh_origin';

export interface RateLimitAttempt {
  scope: AuthRateLimitScope;
  keyHash: string;
  maximumAttempts: number;
}

interface LockedRefreshRow {
  tokenHash: string;
  tokenExpiresAt: Date;
  consumedAt: Date | null;
  familyId: string;
  familyExpiresAt: Date;
  revokedAt: Date | null;
  csrfHash: string;
  userId: string;
  email: string;
  isActive: boolean;
}

const safeHashEquals = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

const parseLockedRefreshRow = (value: unknown): LockedRefreshRow | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const row = value as Record<string, unknown>;
  if (
    typeof row.tokenHash !== 'string' ||
    !(row.tokenExpiresAt instanceof Date) ||
    (row.consumedAt !== null && !(row.consumedAt instanceof Date)) ||
    typeof row.familyId !== 'string' ||
    !(row.familyExpiresAt instanceof Date) ||
    (row.revokedAt !== null && !(row.revokedAt instanceof Date)) ||
    typeof row.csrfHash !== 'string' ||
    typeof row.userId !== 'string' ||
    typeof row.email !== 'string' ||
    typeof row.isActive !== 'boolean'
  ) {
    return undefined;
  }
  return {
    tokenHash: row.tokenHash,
    tokenExpiresAt: row.tokenExpiresAt,
    consumedAt: row.consumedAt,
    familyId: row.familyId,
    familyExpiresAt: row.familyExpiresAt,
    revokedAt: row.revokedAt,
    csrfHash: row.csrfHash,
    userId: row.userId,
    email: row.email,
    isActive: row.isActive,
  };
};

@Injectable()
export class AuthRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async findUserByEmail(email: string): Promise<AuthUserRecord | undefined> {
    const [user] = await this.database
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return user;
  }

  async createUser(email: string, passwordHash: string): Promise<{ id: string; email: string }> {
    const [user] = await this.database
      .insert(users)
      .values({ email, passwordHash })
      .returning({ id: users.id, email: users.email });
    if (!user) throw new Error('User insertion returned no row');
    return user;
  }

  async createRefreshSession(input: NewRefreshSession): Promise<string> {
    return this.database.transaction(async (transaction) => {
      const [family] = await transaction
        .insert(authRefreshTokenFamilies)
        .values({
          userId: input.userId,
          csrfHash: input.csrfHash,
          expiresAt: input.expiresAt,
        })
        .returning({ id: authRefreshTokenFamilies.id });
      if (!family) throw new Error('Refresh family insertion returned no row');
      await transaction.insert(authRefreshTokens).values({
        id: input.tokenId,
        familyId: family.id,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      });
      return family.id;
    });
  }

  async rotateRefreshSession(input: RotateRefreshSession): Promise<RefreshRotation> {
    return this.database.transaction(async (transaction) => {
      const result = await transaction.execute(sql`
        SELECT
          t.token_hash AS "tokenHash",
          t.expires_at AS "tokenExpiresAt",
          t.consumed_at AS "consumedAt",
          f.id AS "familyId",
          f.expires_at AS "familyExpiresAt",
          f.revoked_at AS "revokedAt",
          f.csrf_hash AS "csrfHash",
          u.id AS "userId",
          u.email AS "email",
          u.is_active AS "isActive"
        FROM auth_refresh_tokens t
        INNER JOIN auth_refresh_token_families f ON f.id = t.family_id
        INNER JOIN users u ON u.id = f.user_id
        WHERE t.id = ${input.tokenId}
        FOR UPDATE OF t, f
      `);
      const row = parseLockedRefreshRow(result.rows[0]);
      if (!row || !safeHashEquals(row.tokenHash, input.tokenHash)) return { status: 'invalid' };

      const now = new Date();
      if (row.consumedAt) {
        await transaction
          .update(authRefreshTokenFamilies)
          .set({ revokedAt: now, updatedAt: now })
          .where(eq(authRefreshTokenFamilies.id, row.familyId));
        return { status: 'replay' };
      }
      if (
        row.revokedAt ||
        row.tokenExpiresAt <= now ||
        row.familyExpiresAt <= now ||
        !safeHashEquals(row.csrfHash, input.csrfHash)
      ) {
        return { status: 'invalid' };
      }
      if (!row.isActive) {
        await transaction
          .update(authRefreshTokenFamilies)
          .set({ revokedAt: now, updatedAt: now })
          .where(eq(authRefreshTokenFamilies.id, row.familyId));
        return { status: 'invalid' };
      }

      await transaction.insert(authRefreshTokens).values({
        id: input.nextTokenId,
        familyId: row.familyId,
        tokenHash: input.nextTokenHash,
        expiresAt: input.nextExpiresAt,
      });
      await transaction
        .update(authRefreshTokens)
        .set({ consumedAt: now })
        .where(eq(authRefreshTokens.id, input.tokenId));
      return {
        status: 'rotated',
        user: { id: row.userId, email: row.email },
        familyId: row.familyId,
      };
    });
  }

  async revokeRefreshFamily(tokenId: string, tokenHash: string): Promise<void> {
    await this.database.transaction(async (transaction) => {
      const result = await transaction.execute(sql`
        SELECT
          t.token_hash AS "tokenHash",
          t.expires_at AS "tokenExpiresAt",
          t.consumed_at AS "consumedAt",
          f.id AS "familyId",
          f.expires_at AS "familyExpiresAt",
          f.revoked_at AS "revokedAt",
          f.csrf_hash AS "csrfHash",
          u.id AS "userId",
          u.email AS "email",
          u.is_active AS "isActive"
        FROM auth_refresh_tokens t
        INNER JOIN auth_refresh_token_families f ON f.id = t.family_id
        INNER JOIN users u ON u.id = f.user_id
        WHERE t.id = ${tokenId}
        FOR UPDATE OF t, f
      `);
      const row = parseLockedRefreshRow(result.rows[0]);
      if (!row || !safeHashEquals(row.tokenHash, tokenHash)) {
        return;
      }
      const now = new Date();
      await transaction
        .update(authRefreshTokenFamilies)
        .set({ revokedAt: now, updatedAt: now })
        .where(eq(authRefreshTokenFamilies.id, row.familyId));
    });
  }

  async revokeRefreshFamilyById(familyId: string): Promise<void> {
    const now = new Date();
    await this.database
      .update(authRefreshTokenFamilies)
      .set({ revokedAt: now, updatedAt: now })
      .where(eq(authRefreshTokenFamilies.id, familyId));
  }

  async admitRateLimitAttempts(
    attempts: readonly RateLimitAttempt[],
    windowSeconds: number,
    blockSeconds: number,
  ): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      let allAdmitted = true;
      for (const attempt of attempts) {
        const result = await transaction.execute(sql`
          INSERT INTO auth_rate_limits (
            scope, key_hash, window_started_at, failures, blocked_until, updated_at
          ) VALUES (
            ${attempt.scope},
            ${attempt.keyHash},
            now(),
            1,
            NULL,
            now()
          )
          ON CONFLICT (scope, key_hash) DO UPDATE SET
            window_started_at = CASE
              WHEN auth_rate_limits.blocked_until > now()
                THEN auth_rate_limits.window_started_at
              WHEN auth_rate_limits.window_started_at <= now() - (${windowSeconds} * interval '1 second')
                THEN now()
              ELSE auth_rate_limits.window_started_at
            END,
            failures = CASE
              WHEN auth_rate_limits.blocked_until > now()
                THEN auth_rate_limits.failures
              WHEN auth_rate_limits.window_started_at <= now() - (${windowSeconds} * interval '1 second')
                THEN 1
              ELSE auth_rate_limits.failures + 1
            END,
            blocked_until = CASE
              WHEN auth_rate_limits.blocked_until > now()
                THEN auth_rate_limits.blocked_until
              WHEN auth_rate_limits.window_started_at <= now() - (${windowSeconds} * interval '1 second')
                THEN NULL
              WHEN auth_rate_limits.failures >= ${attempt.maximumAttempts}
                THEN now() + (${blockSeconds} * interval '1 second')
              ELSE NULL
            END,
            updated_at = now()
          RETURNING (blocked_until IS NULL OR blocked_until <= now()) AS "admitted"
        `);
        const row = result.rows[0];
        if (!row || typeof row.admitted !== 'boolean' || !row.admitted) allAdmitted = false;
      }
      return allAdmitted;
    });
  }

  async clearRateLimit(scope: AuthRateLimitScope, keyHash: string): Promise<void> {
    await this.database
      .delete(authRateLimits)
      .where(and(eq(authRateLimits.scope, scope), eq(authRateLimits.keyHash, keyHash)));
  }
}
