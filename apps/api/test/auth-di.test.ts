import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { LoginUseCase } from '../src/modules/auth/domain/use-cases/login.use-case.js';
import type { AuthProviderPort } from '../src/modules/auth/domain/auth-provider.js';
import { LOGIN_USE_CASE } from '../src/modules/auth/auth.tokens.js';

const provider: AuthProviderPort = {
  signIn: vi.fn(),
  getPrincipal: vi.fn(),
  refreshSession: vi.fn(),
  signOut: vi.fn(),
};

@Module({
  providers: [{ provide: LOGIN_USE_CASE, useFactory: () => new LoginUseCase(provider) }],
})
class TestAuthModule {}

describe('auth Nest dependency injection', () => {
  let app: Awaited<ReturnType<typeof NestFactory.createApplicationContext>>;

  beforeAll(async () => {
    app = await NestFactory.createApplicationContext(TestAuthModule, { logger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  it('resolves explicit auth dependencies under the test transformer', () => {
    expect(Reflect.getMetadata('design:paramtypes', LoginUseCase)).toBeUndefined();
    expect(app.get(LOGIN_USE_CASE)).toBeInstanceOf(LoginUseCase);
  });
});
