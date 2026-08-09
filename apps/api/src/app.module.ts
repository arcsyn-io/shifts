import { MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common';
import { loadConfig } from '@arcsyn-shift/config';
import { ApplicationContextMiddleware } from './infrastructure/context/application-context.middleware.js';
import { ApplicationContextModule } from './infrastructure/context/application-context.module.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { McpModule } from './infrastructure/mcp/mcp.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { HealthMcpTool } from './modules/health/presentation/mcp/health-mcp.tool.js';
import { AuthModule } from './modules/auth/index.js';
import { OrganizationsModule } from './modules/organizations/index.js';

const config = loadConfig();

@Module({
  imports: [
    ApplicationContextModule,
    DatabaseModule,
    AuthModule,
    OrganizationsModule,
    HealthModule,
    ...(config.MCP_ENABLED
      ? [McpModule.register({ imports: [HealthModule], tools: [HealthMcpTool] })]
      : []),
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(ApplicationContextMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
