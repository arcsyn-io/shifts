import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { McpProtocolError, McpServer } from './mcp-server.js';

@Controller('mcp')
export class McpController {
  constructor(@Inject(McpServer) private readonly server: McpServer) {}

  @Get()
  info() {
    return { name: 'arcsyn-shift-mcp', tools: this.server.listTools().tools };
  }

  @Post()
  async call(@Body() body: { method?: string; params?: { name?: string } }) {
    if (body.method === 'tools/list') return this.server.listTools();
    if (body.method === 'tools/call') {
      if (!body.params?.name) {
        return { error: { code: -32602, message: 'Invalid params' } };
      }
      try {
        const result = await this.server.callTool(body.params.name);
        if (isMcpToolErrorOutcome(result)) return result;
        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
        };
      } catch (error) {
        if (error instanceof McpProtocolError) {
          return { error: { code: error.code, message: error.message } };
        }
        return { error: { code: -32603, message: 'Internal error' } };
      }
    }
    return { error: { code: -32601, message: 'Unsupported MCP method' } };
  }
}

function isMcpToolErrorOutcome(value: unknown): value is { isError: true } {
  return (
    typeof value === 'object' && value !== null && 'isError' in value && value.isError === true
  );
}
