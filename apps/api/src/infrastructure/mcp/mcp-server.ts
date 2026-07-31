import { Inject, Injectable } from '@nestjs/common';
import type { McpTool } from './mcp-tool.js';

export const MCP_TOOLS = Symbol('MCP_TOOLS');

@Injectable()
export class McpServer {
  constructor(@Inject(MCP_TOOLS) private readonly tools: readonly McpTool[]) {}

  listTools() {
    return {
      tools: this.tools.map(({ name, description }) => ({ name, description })),
    };
  }

  callTool(name: string) {
    const tool = this.tools.find((candidate) => candidate.name === name);
    if (!tool) throw new Error(`Unknown MCP tool: ${name}`);
    return tool.call();
  }
}
