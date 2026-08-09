import { TransactionManager } from './transaction-manager.js';

interface TransactionalInstance {
  transactionManager: TransactionManager;
}

type TransactionalMethod = (...args: unknown[]) => Promise<unknown>;

export function Transactional(): MethodDecorator {
  return (_target, _propertyKey, descriptor: PropertyDescriptor): void => {
    const method = descriptor.value as TransactionalMethod;
    descriptor.value = function (
      this: TransactionalInstance,
      ...args: unknown[]
    ): Promise<unknown> {
      if (!(this.transactionManager instanceof TransactionManager)) {
        throw new TypeError('@Transactional() requires a TransactionManager instance');
      }
      return this.transactionManager.run(() => method.apply(this, args));
    };
  };
}
