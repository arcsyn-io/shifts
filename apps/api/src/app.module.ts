import { Module } from '@nestjs/common';
import { loadConfig } from '@arcsyn-shift/config';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { McpModule } from './infrastructure/mcp/mcp.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { HealthMcpTool } from './modules/health/presentation/mcp/health-mcp.tool.js';
import { AuthModule } from './modules/auth/auth.module.js';

const config = loadConfig();

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    HealthModule,
    ...(config.MCP_ENABLED
      ? [McpModule.register({ imports: [HealthModule], tools: [HealthMcpTool] })]
      : []),
  ],
})
export class AppModule {}
