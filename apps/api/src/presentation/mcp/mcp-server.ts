import { Injectable } from '@nestjs/common';
import { HealthService } from '../../application/health.service.js';

export const MCP_HEALTH_CHECK_TOOL = 'health_check';

@Injectable()
export class McpServer {
  readonly tools = [MCP_HEALTH_CHECK_TOOL] as const;

  constructor(private readonly healthService: HealthService) {}

  listTools() {
    return {
      tools: [{ name: MCP_HEALTH_CHECK_TOOL, description: 'Checks the ArcSyn Shift MCP adapter.' }],
    };
  }

  callTool(name: string) {
    if (name !== MCP_HEALTH_CHECK_TOOL) throw new Error(`Unknown MCP tool: ${name}`);
    return this.healthService.getMcpHealth();
  }
}
