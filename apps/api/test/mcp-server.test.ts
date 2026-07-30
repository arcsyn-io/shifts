import { describe, expect, it } from 'vitest';
import { HealthService } from '../src/application/health.service.js';
import { McpServer } from '../src/presentation/mcp/mcp-server.js';

describe('McpServer', () => {
  it('registers health_check', () =>
    expect(new McpServer(new HealthService()).tools).toContain('health_check'));
  it('uses the application service for the tool response', () =>
    expect(new McpServer(new HealthService()).callTool('health_check')).toEqual({
      status: 'ok',
      service: 'arcsyn-shift-mcp',
    }));
});
