import { Module } from '@nestjs/common';
import { loadConfig } from '@arcsyn-shift/config';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { HttpModule } from './presentation/http/http.module.js';
import { McpModule } from './presentation/mcp/mcp.module.js';

const config = loadConfig();

@Module({ imports: [DatabaseModule, HttpModule, ...(config.MCP_ENABLED ? [McpModule] : [])] })
export class AppModule {}
