import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import {
  ApplicationContext,
  ApplicationContextAuthenticator,
  ApplicationContextError,
} from '../src/infrastructure/context/application-context.js';
import { ApplicationContextMiddleware } from '../src/infrastructure/context/application-context.middleware.js';

const firstPrincipal = {
  id: '6aa5bbc6-4888-4b72-a2a7-37ca3bdb786f',
  email: 'first@example.com',
};
const secondPrincipal = {
  id: 'a166a3c2-401b-47a4-aeb4-e807b2dffe41',
  email: 'second@example.com',
};

describe('ApplicationContext', () => {
  it('keeps the principal across await boundaries', async () => {
    const context = new ApplicationContext();
    const authenticator = new ApplicationContextAuthenticator(context);

    await context.run(async () => {
      authenticator.setPrincipal(firstPrincipal);
      await Promise.resolve();
      expect(context.getPrincipal()).toEqual(firstPrincipal);
    });
  });

  it('opens the store in middleware before the next request stage runs', async () => {
    const context = new ApplicationContext();
    const middleware = new ApplicationContextMiddleware(context);
    const authenticator = new ApplicationContextAuthenticator(context);
    const raw = new EventEmitter();

    await new Promise<void>((resolve, reject) => {
      middleware.use({} as never, raw as never, () => {
        authenticator.setPrincipal(firstPrincipal);
        Promise.resolve()
          .then(() => expect(context.getPrincipal()).toEqual(firstPrincipal))
          .then(() => {
            raw.emit('finish');
          })
          .then(resolve, reject);
      });
    });
  });

  it.each(['finish', 'close'] as const)(
    'invalidates the request store when the response emits %s',
    (event) => {
      const context = new ApplicationContext();
      const middleware = new ApplicationContextMiddleware(context);
      const authenticator = new ApplicationContextAuthenticator(context);
      const raw = new EventEmitter();

      middleware.use({} as never, raw as never, () => {
        authenticator.setPrincipal(firstPrincipal);
        raw.emit(event);
        expect(() => context.getPrincipal()).toThrowError(
          expect.objectContaining<Partial<ApplicationContextError>>({ kind: 'closed_context' }),
        );
      });
    },
  );

  it('isolates concurrent asynchronous executions', async () => {
    const context = new ApplicationContext();
    const authenticator = new ApplicationContextAuthenticator(context);
    let releaseFirst: (() => void) | undefined;
    let releaseSecond: (() => void) | undefined;
    const firstBarrier = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const secondBarrier = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });

    const first = context.run(async () => {
      authenticator.setPrincipal(firstPrincipal);
      releaseSecond?.();
      await firstBarrier;
      return context.getPrincipal();
    });
    const second = context.run(async () => {
      authenticator.setPrincipal(secondPrincipal);
      releaseFirst?.();
      await secondBarrier;
      return context.getPrincipal();
    });

    await expect(first).resolves.toEqual(firstPrincipal);
    await expect(second).resolves.toEqual(secondPrincipal);
  });

  it('rejects every second principal assignment without replacing the first', () => {
    const context = new ApplicationContext();
    const authenticator = new ApplicationContextAuthenticator(context);

    context.run(() => {
      authenticator.setPrincipal(firstPrincipal);
      expect(() => authenticator.setPrincipal(secondPrincipal)).toThrowError(
        expect.objectContaining<Partial<ApplicationContextError>>({
          kind: 'already_set',
          value: 'principal',
        }),
      );
      expect(context.getPrincipal()).toEqual(firstPrincipal);
    });
  });

  it('fails closed when accessed outside a request context', () => {
    const context = new ApplicationContext();
    expect(() => context.getPrincipal()).toThrowError(
      expect.objectContaining<Partial<ApplicationContextError>>({ kind: 'missing_context' }),
    );
  });

  it('invalidates detached asynchronous work when the execution finishes', async () => {
    const context = new ApplicationContext();
    const authenticator = new ApplicationContextAuthenticator(context);
    let detachedRead: Promise<ApplicationContextError> | undefined;

    await context.run(async () => {
      authenticator.setPrincipal(firstPrincipal);
      detachedRead = new Promise((resolve) => {
        setTimeout(() => {
          try {
            context.getPrincipal();
          } catch (error) {
            resolve(error as ApplicationContextError);
          }
        }, 0);
      });
    });

    await expect(detachedRead).resolves.toEqual(
      expect.objectContaining<Partial<ApplicationContextError>>({ kind: 'closed_context' }),
    );
  });
});
