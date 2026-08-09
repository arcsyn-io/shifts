import { Injectable } from '@nestjs/common';
import {
  sql,
  userProfiles,
  withPrincipalContext,
  type Database,
  type DatabaseTransaction,
} from '@arcsyn-shift/database';
import {
  ApplicationContext,
  ApplicationTransactionContext,
} from '../context/application-context.js';

@Injectable()
export class TransactionManager {
  constructor(
    private readonly database: Database,
    private readonly applicationContext: ApplicationContext,
    private readonly transactionContext: ApplicationTransactionContext,
  ) {}

  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.transactionContext.getTransaction()) return operation();

    const principal = this.applicationContext.getPrincipal();
    return withPrincipalContext(this.database, principal.id, async (transaction) => {
      this.transactionContext.setTransaction(transaction);
      try {
        await transaction.execute(sql`select set_config('app.locked_organization_id', '', true)`);
        await syncUserProfile(transaction, principal);
        return await operation();
      } finally {
        this.transactionContext.clearTransaction(transaction);
      }
    });
  }

  getTransaction(): DatabaseTransaction {
    return this.transactionContext.requireTransaction();
  }

  async selectOrganization(organizationId: string): Promise<void> {
    const transaction = this.getTransaction();
    this.transactionContext.setOrganizationId(organizationId);
    await transaction.execute(
      sql`select set_config('app.current_organization_id', ${organizationId}, true)`,
    );
  }
}

async function syncUserProfile(
  transaction: DatabaseTransaction,
  principal: Readonly<{ id: string; email: string }>,
): Promise<void> {
  const email = principal.email.trim().toLowerCase();
  await transaction
    .insert(userProfiles)
    .values({ id: principal.id, email })
    .onConflictDoUpdate({
      target: userProfiles.id,
      set: { email, updatedAt: new Date() },
    });
}
