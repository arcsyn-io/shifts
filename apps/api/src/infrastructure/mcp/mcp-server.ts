import { Inject, Injectable } from '@nestjs/common';
import { ErrorReporter } from '../errors/error-reporter.js';
import {
  genericMcpToolError,
  type McpErrorHandler,
  type McpToolErrorOutcome,
} from './mcp-error-handler.js';
import type { McpTool } from './mcp-tool.js';

export const MCP_TOOLS = Symbol('MCP_TOOLS');

export class McpProtocolError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
    this.name = 'McpProtocolError';
  }
}

@Injectable()
export class McpServer {
  constructor(
    @Inject(MCP_TOOLS) private readonly tools: readonly McpTool[],
    private readonly errorHandlers: readonly McpErrorHandler[] = [],
    private readonly errorReporter?: ErrorReporter,
  ) {}

  listTools() {
    return {
      tools: this.tools.map(({ name, description }) => ({ name, description })),
    };
  }

  async callTool(name: string): Promise<unknown | McpToolErrorOutcome> {
    const tool = this.tools.find((candidate) => candidate.name === name);
    if (!tool) throw new McpProtocolError(-32602, 'Invalid params');

    try {
      return await tool.call();
    } catch (error) {
      for (const handler of this.errorHandlers) {
        try {
          if (handler.canHandle(error)) return handler.handle(error);
        } catch (handlerError) {
          this.errorReporter?.report(handlerError, {
            transport: 'mcp',
            category: 'mcp_tool_failure',
          });
          return genericMcpToolError();
        }
      }

      this.errorReporter?.report(error, {
        transport: 'mcp',
        category: 'mcp_tool_failure',
      });
      return genericMcpToolError();
    }
  }
}
