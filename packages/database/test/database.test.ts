import { describe, expect, it, vi } from 'vitest';
import { createDatabase, withPrincipalContext } from '../src/index.js';

describe('database', () => {
  it('initializes a PostgreSQL connection pool', async () => {
    const { pool } = createDatabase('postgresql://localhost:5432/arcsyn_shift');
    expect(pool.options.connectionString).toBe('postgresql://localhost:5432/arcsyn_shift');
    await pool.end();
  });

  it('sets role and request context locally inside a transaction', async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const database = {
      transaction: vi.fn(async (operation) => operation({ execute })),
    } as unknown as Parameters<typeof withPrincipalContext>[0];

    await withPrincipalContext(
      database,
      '84c326ab-69e5-44bc-8f86-1a46b47c56c8',
      async () => 'ok',
      '14d7152f-3c12-4a21-b446-5dc897159eb5',
    );

    expect(execute).toHaveBeenCalledTimes(3);
  });
});
