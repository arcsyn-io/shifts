import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { loadConfig } from '@arcsyn-shift/config';
import { createDatabase, type Database } from '@arcsyn-shift/database';
import type { Pool } from 'pg';
import { ApplicationContextModule } from '../context/application-context.module.js';
import {
  ApplicationContext,
  ApplicationTransactionContext,
} from '../context/application-context.js';
import { TransactionManager } from './transaction-manager.js';

export const DATABASE = Symbol('DATABASE');
export const DATABASE_POOL = Symbol('DATABASE_POOL');
export const DATABASE_CONNECTION = Symbol('DATABASE_CONNECTION');

@Global()
@Module({
  imports: [ApplicationContextModule],
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
    ApplicationTransactionContext,
    {
      provide: TransactionManager,
      useFactory: (
        database: Database,
        applicationContext: ApplicationContext,
        transactionContext: ApplicationTransactionContext,
      ) => new TransactionManager(database, applicationContext, transactionContext),
      inject: [DATABASE, ApplicationContext, ApplicationTransactionContext],
    },
  ],
  exports: [DATABASE_POOL, TransactionManager],
})
export class DatabaseModule implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}
}

export type DatabaseConnection = Database;
