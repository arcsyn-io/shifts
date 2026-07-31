import { describe, expect, it } from 'vitest';
import { McpServer } from '../src/infrastructure/mcp/mcp-server.js';
import { HealthService } from '../src/modules/health/application/health.service.js';
import { CheckHealthUseCase } from '../src/modules/health/domain/use-cases/check-health.use-case.js';
import { HealthMcpTool } from '../src/modules/health/presentation/mcp/health-mcp.tool.js';

const createServer = () => {
  const service = new HealthService(new CheckHealthUseCase());
  return new McpServer([new HealthMcpTool(service)]);
};

describe('McpServer', () => {
  it('registers health_check', () =>
    expect(createServer().listTools().tools).toContainEqual({
      name: 'health_check',
      description: 'Checks the ArcSyn Shift MCP adapter.',
    }));
  it('uses the application service for the tool response', () =>
    expect(createServer().callTool('health_check')).toEqual({
      status: 'ok',
      service: 'arcsyn-shift-mcp',
    }));

  it('rejects tools that were not registered', () =>
    expect(() => createServer().callTool('unknown')).toThrow('Unknown MCP tool: unknown'));
});
