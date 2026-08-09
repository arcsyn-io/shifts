import type { Database } from '@arcsyn-shift/database';
import { describe, expect, it } from 'vitest';
import {
  ApplicationContext,
  ApplicationTransactionContext,
} from '../src/infrastructure/context/application-context.js';
import { TransactionManager } from '../src/infrastructure/database/transaction-manager.js';
import { DrizzleOrganizationsRepository } from '../src/modules/organizations/repository/drizzle-organizations.repository.js';
import { OrganizationRepositoryError } from '../src/modules/organizations/repository/organizations.repository.js';

describe('DrizzleOrganizationsRepository transaction boundary', () => {
  it('fails before issuing SQL when there is no active transaction', async () => {
    const context = new ApplicationContext();
    const manager = new TransactionManager(
      {} as Database,
      context,
      new ApplicationTransactionContext(context),
    );
    const repository = new DrizzleOrganizationsRepository(manager);

    await context.run(async () => {
      await expect(repository.listOrganizations()).rejects.toEqual(
        expect.objectContaining<Partial<OrganizationRepositoryError>>({ kind: 'unavailable' }),
      );
    });
  });

  it('classifies a technical database permission failure as unavailable and preserves its cause', async () => {
    const databaseError = { code: '42501', detail: 'canary-private-detail' };
    const manager = {
      getTransaction: () => ({
        execute: () => {
          throw databaseError;
        },
      }),
    } as unknown as TransactionManager;
    const repository = new DrizzleOrganizationsRepository(manager);

    const failure = repository.listOrganizations();

    await expect(failure).rejects.toEqual(
      expect.objectContaining<Partial<OrganizationRepositoryError>>({ kind: 'unavailable' }),
    );
    await expect(failure).rejects.toHaveProperty('cause', databaseError);
  });
});
