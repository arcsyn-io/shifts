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
    app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  it('resolves the organizations module with guards exported by auth', async () => {
    const { OrganizationsService } =
      await import('../src/modules/organizations/application/organizations.service.js');
    expect(app.get(OrganizationsService)).toBeInstanceOf(OrganizationsService);
  });
});
