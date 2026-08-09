import { DynamicModule, Module, type ModuleMetadata, type Type } from '@nestjs/common';
import { ErrorReporter } from '../errors/error-reporter.js';
import { ErrorReportingModule } from '../errors/error-reporting.module.js';
import { MCP_ERROR_HANDLERS, type McpErrorHandler } from './mcp-error-handler.js';
import type { McpTool } from './mcp-tool.js';
import { McpController } from './mcp.controller.js';
import { MCP_TOOLS, McpServer } from './mcp-server.js';

interface McpModuleOptions {
  imports?: ModuleMetadata['imports'];
  tools: Type<McpTool>[];
  errorHandlers?: Type<McpErrorHandler>[];
}

@Module({})
export class McpModule {
  static register({ imports = [], tools, errorHandlers = [] }: McpModuleOptions): DynamicModule {
    return {
      module: McpModule,
      imports: [ErrorReportingModule, ...imports],
      controllers: [McpController],
      providers: [
        {
          provide: MCP_TOOLS,
          inject: tools,
          useFactory: (...registeredTools: McpTool[]) => registeredTools,
        },
        {
          provide: MCP_ERROR_HANDLERS,
          inject: errorHandlers,
          useFactory: (...registeredHandlers: McpErrorHandler[]) => registeredHandlers,
        },
        {
          provide: McpServer,
          inject: [MCP_TOOLS, MCP_ERROR_HANDLERS, ErrorReporter],
          useFactory: (
            registeredTools: readonly McpTool[],
            registeredHandlers: readonly McpErrorHandler[],
            errorReporter: ErrorReporter,
          ) => new McpServer(registeredTools, registeredHandlers, errorReporter),
        },
      ],
    };
  }
}
