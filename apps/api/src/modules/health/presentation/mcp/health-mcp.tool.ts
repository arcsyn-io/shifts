import { Inject, Injectable } from '@nestjs/common';
import type { McpTool } from '../../../../infrastructure/mcp/mcp-tool.js';
import { HealthService } from '../../application/health.service.js';

export const MCP_HEALTH_CHECK_TOOL = 'health_check';

@Injectable()
export class HealthMcpTool implements McpTool {
  readonly name = MCP_HEALTH_CHECK_TOOL;
  readonly description = 'Checks the ArcSyn Shift MCP adapter.';

  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  call() {
    return this.healthService.getMcpHealth();
  }
}
