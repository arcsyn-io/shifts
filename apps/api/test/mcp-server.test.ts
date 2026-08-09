import { describe, expect, it, vi } from 'vitest';
import { ErrorReporter } from '../src/infrastructure/errors/error-reporter.js';
import type { McpErrorHandler } from '../src/infrastructure/mcp/mcp-error-handler.js';
import { McpController } from '../src/infrastructure/mcp/mcp.controller.js';
import { McpProtocolError, McpServer } from '../src/infrastructure/mcp/mcp-server.js';
import type { McpTool } from '../src/infrastructure/mcp/mcp-tool.js';
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
  it('uses the application service for the tool response', async () =>
    await expect(createServer().callTool('health_check')).resolves.toEqual({
      status: 'ok',
      service: 'arcsyn-shift-mcp',
    }));

  it('rejects tools that were not registered as a sanitized protocol error', async () => {
    await expect(createServer().callTool('unknown')).rejects.toEqual(
      expect.objectContaining<Partial<McpProtocolError>>({
        code: -32602,
        message: 'Invalid params',
      }),
    );
  });

  it.each([
    [
      'synchronous',
      () => {
        throw new Error('canary-secret');
      },
    ],
    ['asynchronous', () => Promise.reject(new Error('canary-secret'))],
  ])('sanitizes an unexpected %s tool failure', async (_kind, call) => {
    const log = vi.fn();
    const tool: McpTool = { name: 'failure', description: 'Fails safely.', call };
    const server = new McpServer([tool], [], new ErrorReporter({ error: log }));

    const result = await server.callTool(tool.name);

    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            code: 'MCP_TOOL_ERROR',
            message: 'Não foi possível concluir a operação.',
          }),
        },
      ],
      isError: true,
    });
    expect(JSON.stringify(result)).not.toContain('canary-secret');
    expect(log).toHaveBeenCalledOnce();
    expect(JSON.stringify(log.mock.calls)).not.toContain('canary-secret');
  });

  it('delegates semantic failures to a registered MCP presentation handler', async () => {
    class SemanticError extends Error {}
    const error = new SemanticError('private-detail');
    const handler: McpErrorHandler = {
      canHandle: (candidate) => candidate instanceof SemanticError,
      handle: () => ({
        content: [{ type: 'text', text: '{"code":"SEMANTIC_CONFLICT"}' }],
        isError: true,
      }),
    };
    const tool: McpTool = {
      name: 'semantic-failure',
      description: 'Fails semantically.',
      call: () => Promise.reject(error),
    };

    await expect(new McpServer([tool], [handler]).callTool(tool.name)).resolves.toEqual({
      content: [{ type: 'text', text: '{"code":"SEMANTIC_CONFLICT"}' }],
      isError: true,
    });
  });

  it('preserves an isError tool outcome through the MCP controller', async () => {
    const outcome = {
      content: [{ type: 'text' as const, text: '{"code":"SEMANTIC_CONFLICT"}' }],
      isError: true as const,
    };
    const server = {
      callTool: vi.fn().mockResolvedValue(outcome),
    } as unknown as McpServer;
    const controller = new McpController(server);

    await expect(
      controller.call({ method: 'tools/call', params: { name: 'semantic-failure' } }),
    ).resolves.toBe(outcome);
  });

  it('falls back safely when an MCP error handler itself fails', async () => {
    const log = vi.fn();
    const handler: McpErrorHandler = {
      canHandle: () => {
        throw new Error('handler-canary-secret');
      },
      handle: () => {
        throw new Error('unreachable');
      },
    };
    const tool: McpTool = {
      name: 'handler-failure',
      description: 'Exercises the handler fallback.',
      call: () => Promise.reject(new Error('tool-canary-secret')),
    };
    const server = new McpServer([tool], [handler], new ErrorReporter({ error: log }));

    const result = await server.callTool(tool.name);

    expect(result).toEqual(expect.objectContaining({ isError: true }));
    expect(JSON.stringify(result)).not.toContain('canary-secret');
    expect(JSON.stringify(log.mock.calls)).not.toContain('canary-secret');
    expect(log).toHaveBeenCalledOnce();
  });
});
