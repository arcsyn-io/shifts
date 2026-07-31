import { Body, Controller, Get, Post } from '@nestjs/common';
import { McpServer } from './mcp-server.js';

@Controller('mcp')
export class McpController {
  constructor(private readonly server: McpServer) {}

  @Get()
  info() {
    return { name: 'arcsyn-shift-mcp', tools: this.server.listTools().tools };
  }

  @Post()
  call(@Body() body: { method?: string; params?: { name?: string } }) {
    if (body.method === 'tools/list') return this.server.listTools();
    if (body.method === 'tools/call' && body.params?.name)
      return {
        content: [{ type: 'text', text: JSON.stringify(this.server.callTool(body.params.name)) }],
      };
    return { error: { code: -32601, message: 'Unsupported MCP method' } };
  }
}
