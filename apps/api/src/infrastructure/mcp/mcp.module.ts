import { DynamicModule, Module, type ModuleMetadata, type Type } from '@nestjs/common';
import type { McpTool } from './mcp-tool.js';
import { McpController } from './mcp.controller.js';
import { MCP_TOOLS, McpServer } from './mcp-server.js';

interface McpModuleOptions {
  imports?: ModuleMetadata['imports'];
  tools: Type<McpTool>[];
}

@Module({})
export class McpModule {
  static register({ imports = [], tools }: McpModuleOptions): DynamicModule {
    return {
      module: McpModule,
      imports,
      controllers: [McpController],
      providers: [
        {
          provide: MCP_TOOLS,
          inject: tools,
          useFactory: (...registeredTools: McpTool[]) => registeredTools,
        },
        McpServer,
      ],
    };
  }
}
