import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { McpController } from '../src/infrastructure/mcp/mcp.controller.js';
import { McpModule } from '../src/infrastructure/mcp/mcp.module.js';
import { HealthService } from '../src/modules/health/application/health.service.js';
import { HealthModule } from '../src/modules/health/health.module.js';
import { HealthController } from '../src/modules/health/presentation/http/health.controller.js';
import { HealthMcpTool } from '../src/modules/health/presentation/mcp/health-mcp.tool.js';

@Module({
  imports: [McpModule.register({ imports: [HealthModule], tools: [HealthMcpTool] })],
})
class TestAppModule {}

describe('Nest dependency injection without design:paramtypes metadata', () => {
  let app: Awaited<ReturnType<typeof NestFactory.createApplicationContext>>;

  beforeAll(async () => {
    app = await NestFactory.createApplicationContext(TestAppModule, { logger: false });
  });

  afterAll(async () => {
    await app.close();
  });

  it('runs under the test transformer without constructor type metadata', () => {
    expect(Reflect.getMetadata('design:paramtypes', HealthService)).toBeUndefined();
    expect(Reflect.getMetadata('design:paramtypes', HealthController)).toBeUndefined();
    expect(Reflect.getMetadata('design:paramtypes', HealthMcpTool)).toBeUndefined();
    expect(Reflect.getMetadata('design:paramtypes', McpController)).toBeUndefined();
  });

  it('resolves and invokes the HTTP health composition', () => {
    expect(app.get(HealthService).getHttpHealth()).toEqual({
      status: 'ok',
      database: 'connected',
    });
    expect(app.get(HealthController).getHealth()).toEqual({
      status: 'ok',
      database: 'connected',
    });
  });

  it('resolves and invokes the MCP health composition', () => {
    expect(app.get(HealthMcpTool).call()).toEqual({
      status: 'ok',
      service: 'arcsyn-shift-mcp',
    });
    expect(
      app.get(McpController).call({ method: 'tools/call', params: { name: 'health_check' } }),
    ).toEqual({
      content: [
        {
          type: 'text',
          text: JSON.stringify({ status: 'ok', service: 'arcsyn-shift-mcp' }),
        },
      ],
    });
  });
});
