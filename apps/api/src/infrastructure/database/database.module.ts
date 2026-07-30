import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { loadConfig } from '@arcsyn-shift/config';
import { createDatabase, type Database } from '@arcsyn-shift/database';
import type { Pool } from 'pg';

export const DATABASE = Symbol('DATABASE');
export const DATABASE_POOL = Symbol('DATABASE_POOL');
export const DATABASE_CONNECTION = Symbol('DATABASE_CONNECTION');

@Global()
@Module({
  providers: [
    { provide: DATABASE_CONNECTION, useFactory: () => createDatabase(loadConfig().DATABASE_URL) },
    {
      provide: DATABASE,
      useFactory: (connection: { db: Database }) => connection.db,
      inject: [DATABASE_CONNECTION],
    },
    {
      provide: DATABASE_POOL,
      useFactory: (connection: { pool: Pool }) => connection.pool,
      inject: [DATABASE_CONNECTION],
    },
  ],
  exports: [DATABASE, DATABASE_POOL],
})
export class DatabaseModule implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}
}

export type DatabaseConnection = Database;
