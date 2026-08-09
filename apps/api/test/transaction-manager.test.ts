import type { Database, DatabaseTransaction } from '@arcsyn-shift/database';
import { describe, expect, it, vi } from 'vitest';
import {
  ApplicationContext,
  ApplicationContextAuthenticator,
  ApplicationContextError,
  ApplicationTransactionContext,
} from '../src/infrastructure/context/application-context.js';
import { TransactionManager } from '../src/infrastructure/database/transaction-manager.js';
import { Transactional } from '../src/infrastructure/database/transactional.js';

const principal = {
  id: '6aa5bbc6-4888-4b72-a2a7-37ca3bdb786f',
  email: 'USER@EXAMPLE.COM',
};

function createDatabaseDouble() {
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn(() => ({ onConflictDoUpdate }));
  const transaction = {
    execute: vi.fn().mockResolvedValue({ rows: [] }),
    insert: vi.fn(() => ({ values })),
  } as unknown as DatabaseTransaction;
  const databaseTransaction = vi.fn(
    async <T>(operation: (transaction: DatabaseTransaction) => Promise<T>): Promise<T> =>
      operation(transaction),
  );
  const database = { transaction: databaseTransaction } as unknown as Database;
  return { database, databaseTransaction, onConflictDoUpdate, transaction, values };
}

class NestedTransactionalService {
  constructor(readonly transactionManager: TransactionManager) {}

  @Transactional()
  async inner(): Promise<DatabaseTransaction> {
    await Promise.resolve();
    return this.transactionManager.getTransaction();
  }

  @Transactional()
  async outer(): Promise<[DatabaseTransaction, DatabaseTransaction]> {
    const beforeAwait = this.transactionManager.getTransaction();
    await Promise.resolve();
    const nested = await this.inner();
    return [beforeAwait, nested];
  }
}

describe('TransactionManager', () => {
  it('opens one REQUIRED transaction for nested decorated calls and syncs the principal', async () => {
    const context = new ApplicationContext();
    const authenticator = new ApplicationContextAuthenticator(context);
    const transactionContext = new ApplicationTransactionContext(context);
    const databaseDouble = createDatabaseDouble();
    const manager = new TransactionManager(databaseDouble.database, context, transactionContext);
    const service = new NestedTransactionalService(manager);

    await context.run(async () => {
      authenticator.setPrincipal(principal);
      await expect(service.outer()).resolves.toEqual([
        databaseDouble.transaction,
        databaseDouble.transaction,
      ]);
      expect(transactionContext.getTransaction()).toBeUndefined();
    });

    expect(databaseDouble.databaseTransaction).toHaveBeenCalledOnce();
    expect(databaseDouble.values).toHaveBeenCalledWith({
      id: principal.id,
      email: 'user@example.com',
    });
    expect(databaseDouble.onConflictDoUpdate).toHaveBeenCalledOnce();
  });

  it('cleans the active transaction and tenant after rollback', async () => {
    const context = new ApplicationContext();
    const authenticator = new ApplicationContextAuthenticator(context);
    const transactionContext = new ApplicationTransactionContext(context);
    const databaseDouble = createDatabaseDouble();
    const manager = new TransactionManager(databaseDouble.database, context, transactionContext);

    await context.run(async () => {
      authenticator.setPrincipal(principal);
      await expect(
        manager.run(async () => {
          await manager.selectOrganization('14d7152f-3c12-4a21-b446-5dc897159eb5');
          throw new Error('rollback');
        }),
      ).rejects.toThrow('rollback');
      expect(transactionContext.getTransaction()).toBeUndefined();
      expect(context.getOrganizationId()).toBeUndefined();
    });
  });

  it('sets the tenant immediately and rejects a second selection before more SQL', async () => {
    const context = new ApplicationContext();
    const authenticator = new ApplicationContextAuthenticator(context);
    const transactionContext = new ApplicationTransactionContext(context);
    const databaseDouble = createDatabaseDouble();
    const manager = new TransactionManager(databaseDouble.database, context, transactionContext);

    await context.run(async () => {
      authenticator.setPrincipal(principal);
      await manager.run(async () => {
        await manager.selectOrganization('14d7152f-3c12-4a21-b446-5dc897159eb5');
        expect(context.getOrganizationId()).toBe('14d7152f-3c12-4a21-b446-5dc897159eb5');
        const executeCalls = vi.mocked(databaseDouble.transaction.execute).mock.calls.length;
        await expect(
          manager.selectOrganization('cb002a62-ea1d-480b-9e3a-cd70f6026279'),
        ).rejects.toEqual(
          expect.objectContaining<Partial<ApplicationContextError>>({
            kind: 'already_set',
            value: 'organization',
          }),
        );
        expect(databaseDouble.transaction.execute).toHaveBeenCalledTimes(executeCalls);
      });
    });
  });
});
