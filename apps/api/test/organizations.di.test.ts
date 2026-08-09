import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('organizations Nest dependency injection', () => {
  let app: Awaited<ReturnType<typeof NestFactory.createApplicationContext>>;

  beforeAll(async () => {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://application:password@localhost:5432/test',
      WEB_URL: 'http://localhost:5173',
      API_URL: 'http://localhost:3000',
      MCP_ENABLED: 'false',
      SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
    });
    const { AppModule } = await import('../src/app.module.js');
    app = await NestFactory.createApplicationContext(AppModule, {
      abortOnError: false,
      logger: false,
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('keeps organizations services, repositories and transaction state holders singleton', async () => {
    const { OrganizationsService } =
      await import('../src/modules/organizations/application/organizations.service.js');
    const { ORGANIZATIONS_REPOSITORY } =
      await import('../src/modules/organizations/repository/organizations.repository.js');
    const { TransactionManager } =
      await import('../src/infrastructure/database/transaction-manager.js');
    const { OrganizationsController } =
      await import('../src/modules/organizations/presentation/http/organizations.controller.js');
    expect(app.get(OrganizationsService)).toBe(app.get(OrganizationsService));
    expect(app.get(ORGANIZATIONS_REPOSITORY)).toBe(app.get(ORGANIZATIONS_REPOSITORY));
    expect(app.get(TransactionManager)).toBe(app.get(TransactionManager));
    expect(app.get(OrganizationsController)).toBe(app.get(OrganizationsController));
  });
});
