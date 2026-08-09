import { and, asc, eq, gt, sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

export * from './schema.js';
export { and, asc, eq, gt, sql };

export type Database = NodePgDatabase;
export type DatabaseTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export function createDatabase(connectionString: string): { db: Database; pool: Pool } {
  const pool = new Pool({ connectionString });
  return { db: drizzle(pool), pool };
}

export async function withPrincipalContext<T>(
  database: Database,
  principalId: string,
  operation: (transaction: DatabaseTransaction) => Promise<T>,
  organizationId?: string,
): Promise<T> {
  return database.transaction(async (transaction) => {
    await transaction.execute(sql`set local role arcsyn_shift_runtime`);
    await transaction.execute(sql`select set_config('app.current_user_id', ${principalId}, true)`);
    await transaction.execute(
      sql`select set_config('app.current_organization_id', ${organizationId ?? ''}, true)`,
    );
    return operation(transaction);
  });
}
