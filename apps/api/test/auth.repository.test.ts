import type { Database } from '@arcsyn-shift/database';
import { describe, expect, it, vi } from 'vitest';
import { AuthRepository } from '../src/modules/auth/repository/auth.repository.js';

describe('AuthRepository rate-limit admission', () => {
  it('updates both buckets in one transaction and denies if either bucket is blocked', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ admitted: true }] })
      .mockResolvedValueOnce({ rows: [{ admitted: false }] });
    const transaction = vi.fn(async (operation: (value: { execute: typeof execute }) => unknown) =>
      operation({ execute }),
    );
    const repository = new AuthRepository({ transaction } as unknown as Database);

    await expect(
      repository.admitRateLimitAttempts(
        [
          { scope: 'login_account', keyHash: 'account', maximumAttempts: 5 },
          { scope: 'login_origin', keyHash: 'origin', maximumAttempts: 30 },
        ],
        900,
        900,
      ),
    ).resolves.toBe(false);
    expect(transaction).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('fails closed when PostgreSQL returns an unexpected admission row', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    const transaction = vi.fn(async (operation: (value: { execute: typeof execute }) => unknown) =>
      operation({ execute }),
    );
    const repository = new AuthRepository({ transaction } as unknown as Database);

    await expect(
      repository.admitRateLimitAttempts(
        [{ scope: 'refresh_origin', keyHash: 'origin', maximumAttempts: 60 }],
        900,
        900,
      ),
    ).resolves.toBe(false);
  });
});

describe('AuthRepository family revocation', () => {
  it('revokes a family directly by the signed access-token family id', async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    const repository = new AuthRepository({ update } as unknown as Database);

    await repository.revokeRefreshFamilyById('5b80d5ce-730c-4776-abce-4db60676f803');

    expect(update).toHaveBeenCalledOnce();
    expect(set).toHaveBeenCalledWith({ revokedAt: expect.any(Date), updatedAt: expect.any(Date) });
    expect(where).toHaveBeenCalledOnce();
  });
});
