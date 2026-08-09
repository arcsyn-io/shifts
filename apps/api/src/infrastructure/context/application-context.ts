import { AsyncLocalStorage } from 'node:async_hooks';
import { Inject, Injectable } from '@nestjs/common';
import type { DatabaseTransaction } from '@arcsyn-shift/database';

export interface AuthenticatedPrincipal {
  id: string;
  email: string;
}

interface ApplicationContextStore {
  active: boolean;
  organizationId?: string;
  principal?: Readonly<AuthenticatedPrincipal>;
  transaction?: DatabaseTransaction;
}

export type ApplicationContextValue = 'organization' | 'principal' | 'transaction';

export class ApplicationContextError extends Error {
  constructor(
    readonly kind: 'already_set' | 'closed_context' | 'missing_context' | 'missing_value',
    readonly value?: ApplicationContextValue,
  ) {
    super(value ? `${kind}:${value}` : kind);
    this.name = 'ApplicationContextError';
  }
}

const SET_PRINCIPAL = Symbol('SET_PRINCIPAL');
const GET_TRANSACTION = Symbol('GET_TRANSACTION');
const SET_TRANSACTION = Symbol('SET_TRANSACTION');
const CLEAR_TRANSACTION = Symbol('CLEAR_TRANSACTION');
const SET_ORGANIZATION = Symbol('SET_ORGANIZATION');

@Injectable()
export class ApplicationContext {
  private readonly storage = new AsyncLocalStorage<ApplicationContextStore>();

  run<T>(operation: () => T): T {
    const store = this.createStore();
    return this.storage.run(store, () => {
      try {
        const result = operation();
        if (result instanceof Promise) {
          return result.finally(() => this.close(store)) as T;
        }
        this.close(store);
        return result;
      } catch (error) {
        this.close(store);
        throw error;
      }
    });
  }

  runUntilClosed(operation: (close: () => void) => void): void {
    const store = this.createStore();
    this.storage.run(store, () => {
      try {
        operation(() => this.close(store));
      } catch (error) {
        this.close(store);
        throw error;
      }
    });
  }

  getPrincipal(): Readonly<AuthenticatedPrincipal> {
    const principal = this.requireStore().principal;
    if (!principal) throw new ApplicationContextError('missing_value', 'principal');
    return principal;
  }

  getOrganizationId(): string | undefined {
    return this.requireStore().organizationId;
  }

  [SET_PRINCIPAL](principal: AuthenticatedPrincipal): void {
    const store = this.requireStore();
    if (store.principal) throw new ApplicationContextError('already_set', 'principal');
    store.principal = Object.freeze({ id: principal.id, email: principal.email });
  }

  [GET_TRANSACTION](): DatabaseTransaction | undefined {
    return this.requireStore().transaction;
  }

  [SET_TRANSACTION](transaction: DatabaseTransaction): void {
    const store = this.requireStore();
    if (store.transaction) throw new ApplicationContextError('already_set', 'transaction');
    store.transaction = transaction;
  }

  [CLEAR_TRANSACTION](transaction: DatabaseTransaction): void {
    const store = this.requireStore();
    if (store.transaction !== transaction) {
      throw new ApplicationContextError('missing_value', 'transaction');
    }
    delete store.organizationId;
    delete store.transaction;
  }

  [SET_ORGANIZATION](organizationId: string): void {
    const store = this.requireStore();
    if (store.organizationId !== undefined) {
      throw new ApplicationContextError('already_set', 'organization');
    }
    store.organizationId = organizationId;
  }

  private createStore(): ApplicationContextStore {
    return { active: true };
  }

  private close(store: ApplicationContextStore): void {
    store.active = false;
    delete store.organizationId;
    delete store.principal;
    delete store.transaction;
  }

  private requireStore(): ApplicationContextStore {
    const store = this.storage.getStore();
    if (!store) throw new ApplicationContextError('missing_context');
    if (!store.active) throw new ApplicationContextError('closed_context');
    return store;
  }
}

@Injectable()
export class ApplicationContextAuthenticator {
  constructor(@Inject(ApplicationContext) private readonly context: ApplicationContext) {}

  setPrincipal(principal: AuthenticatedPrincipal): void {
    this.context[SET_PRINCIPAL](principal);
  }
}

@Injectable()
export class ApplicationTransactionContext {
  constructor(@Inject(ApplicationContext) private readonly context: ApplicationContext) {}

  getTransaction(): DatabaseTransaction | undefined {
    return this.context[GET_TRANSACTION]();
  }

  requireTransaction(): DatabaseTransaction {
    const transaction = this.getTransaction();
    if (!transaction) throw new ApplicationContextError('missing_value', 'transaction');
    return transaction;
  }

  setTransaction(transaction: DatabaseTransaction): void {
    this.context[SET_TRANSACTION](transaction);
  }

  clearTransaction(transaction: DatabaseTransaction): void {
    this.context[CLEAR_TRANSACTION](transaction);
  }

  setOrganizationId(organizationId: string): void {
    this.context[SET_ORGANIZATION](organizationId);
  }
}
