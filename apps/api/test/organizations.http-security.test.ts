import 'reflect-metadata';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import {
  ApplicationContext,
  ApplicationContextAuthenticator,
} from '../src/infrastructure/context/application-context.js';
import type { AuthConfig } from '../src/modules/auth/auth.tokens.js';
import {
  BffMutationGuard,
  BffSessionGuard,
  RequireBffJsonBody,
} from '../src/modules/auth/index.js';
import { AuthError } from '../src/modules/auth/auth.error.js';

const config: AuthConfig = {
  nodeEnvironment: 'test',
  supabaseUrl: 'http://127.0.0.1:54321',
  supabasePublishableKey: 'publishable-key',
  webOrigin: 'http://localhost:5173',
};
const principal = {
  id: '6aa5bbc6-4888-4b72-a2a7-37ca3bdb786f',
  email: 'user@example.com',
};

class Routes {
  @RequireBffJsonBody()
  jsonMutation(): void {}

  bodylessMutation(): void {}
}

function createContext(
  headers: Record<string, string | undefined>,
  handler: () => void = Routes.prototype.bodylessMutation,
): { context: ExecutionContext; reply: { header: ReturnType<typeof vi.fn> } } {
  const request = { headers } as unknown as FastifyRequest;
  const reply = { header: vi.fn() };
  return {
    context: {
      getHandler: () => handler,
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => reply as unknown as FastifyReply,
        getNext: () => undefined,
      }),
    } as unknown as ExecutionContext,
    reply,
  };
}

describe('organizations BFF security guards', () => {
  it('validates the authoritative Supabase session on every request', async () => {
    const execute = vi.fn().mockResolvedValue({ response: { principal } });
    const applicationContext = new ApplicationContext();
    const guard = new BffSessionGuard(
      { execute },
      config,
      new ApplicationContextAuthenticator(applicationContext),
    );

    for (let requestNumber = 0; requestNumber < 2; requestNumber += 1) {
      const { context } = createContext({
        cookie: 'arcsyn_access=access-token',
        'sec-fetch-site': 'same-origin',
      });
      await expect(applicationContext.run(() => guard.canActivate(context))).resolves.toBe(true);
    }

    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute).toHaveBeenLastCalledWith({
      accessToken: 'access-token',
      allowRefresh: true,
    });
  });

  it('rejects Bearer credentials before calling the BFF session use case', async () => {
    const execute = vi.fn();
    const applicationContext = new ApplicationContext();
    const guard = new BffSessionGuard(
      { execute },
      config,
      new ApplicationContextAuthenticator(applicationContext),
    );
    const { context } = createContext({ authorization: 'Bearer token' });

    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 401 });
    expect(execute).not.toHaveBeenCalled();
  });

  it('clears invalid browser cookies without exposing provider details', async () => {
    const guard = new BffSessionGuard(
      { execute: vi.fn().mockRejectedValue(new AuthError('invalid_session')) },
      config,
      new ApplicationContextAuthenticator(new ApplicationContext()),
    );
    const { context, reply } = createContext({ cookie: 'arcsyn_access=invalid' });

    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 401 });
    expect(reply.header).toHaveBeenCalledWith('Set-Cookie', expect.any(Array));
  });

  it('defines the authenticated principal once in the request application context', async () => {
    const applicationContext = new ApplicationContext();
    const guard = new BffSessionGuard(
      { execute: vi.fn().mockResolvedValue({ response: { principal } }) },
      config,
      new ApplicationContextAuthenticator(applicationContext),
    );
    const { context } = createContext({ cookie: 'arcsyn_access=access-token' });

    await applicationContext.run(async () => {
      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(applicationContext.getPrincipal()).toEqual(principal);
      await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 503 });
      expect(applicationContext.getPrincipal()).toEqual(principal);
    });
  });

  it.each([undefined, 'https://evil.example'])('rejects mutation origin %s', async (origin) => {
    const sessionGuard = { canActivate: vi.fn() } as unknown as BffSessionGuard;
    const guard = new BffMutationGuard(sessionGuard, config, new Reflector());
    const { context } = createContext({ origin });

    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 403 });
    expect(sessionGuard.canActivate).not.toHaveBeenCalled();
  });

  it.each([
    ['application/json', true],
    ['Application/JSON; charset=utf-8', true],
    [undefined, false],
    ['text/plain', false],
    ['application/json-patch+json', false],
  ])('requires exact JSON media type %s for body mutations', async (contentType, allowed) => {
    const sessionGuard = {
      canActivate: vi.fn().mockResolvedValue(true),
    } as unknown as BffSessionGuard;
    const guard = new BffMutationGuard(sessionGuard, config, new Reflector());
    const { context } = createContext(
      { origin: config.webOrigin, 'content-type': contentType },
      Routes.prototype.jsonMutation,
    );

    if (allowed) {
      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(sessionGuard.canActivate).toHaveBeenCalledOnce();
    } else {
      await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 415 });
      expect(sessionGuard.canActivate).not.toHaveBeenCalled();
    }
  });

  it('allows a bodyless mutation without Content-Type', async () => {
    const sessionGuard = {
      canActivate: vi.fn().mockResolvedValue(true),
    } as unknown as BffSessionGuard;
    const guard = new BffMutationGuard(sessionGuard, config, new Reflector());
    const { context } = createContext({ origin: config.webOrigin });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
