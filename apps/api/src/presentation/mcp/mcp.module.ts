import { Module } from '@nestjs/common';
import { HealthService } from '../../application/health.service.js';
import { McpController } from './mcp.controller.js';
import { McpServer } from './mcp-server.js';

@Module({ controllers: [McpController], providers: [HealthService, McpServer] })
export class McpModule {}
