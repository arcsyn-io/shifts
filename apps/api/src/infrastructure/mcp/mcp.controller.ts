import { Body, Controller, Get, Inject, Post, SetMetadata } from '@nestjs/common';
import { McpServer } from './mcp-server.js';

@SetMetadata('auth:public', true)
@SetMetadata('auth:skip-origin', true)
@Controller('mcp')
export class McpController {
  constructor(@Inject(McpServer) private readonly server: McpServer) {}

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
