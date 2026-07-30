import { describe, expect, it } from 'vitest';
import { createDatabase } from '../src/index.js';

describe('database', () => {
  it('initializes a PostgreSQL connection pool', async () => {
    const { pool } = createDatabase('postgresql://localhost:5432/arcsyn_shift');
    expect(pool.options.connectionString).toBe('postgresql://localhost:5432/arcsyn_shift');
    await pool.end();
  });
});
