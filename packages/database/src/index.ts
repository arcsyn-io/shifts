import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

export * from './schema.js';
export { and, eq, sql } from 'drizzle-orm';

export type Database = NodePgDatabase;

export function createDatabase(connectionString: string): { db: Database; pool: Pool } {
  const pool = new Pool({ connectionString });
  return { db: drizzle(pool), pool };
}
