import { Module } from '@nestjs/common';
import { HealthService } from './application/health.service.js';
import { CheckHealthUseCase } from './domain/check-health.use-case.js';
import { HealthController } from './presentation/http/health.controller.js';
import { HealthMcpTool } from './presentation/mcp/health-mcp.tool.js';

@Module({
  controllers: [HealthController],
  providers: [CheckHealthUseCase, HealthService, HealthMcpTool],
  exports: [HealthMcpTool],
})
export class HealthModule {}
