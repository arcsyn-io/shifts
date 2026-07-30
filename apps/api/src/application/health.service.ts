import { Injectable } from '@nestjs/common';
import type { HealthResponse, McpHealthResponse } from '@arcsyn-shift/contracts';

@Injectable()
export class HealthService {
  getHttpHealth(): HealthResponse {
    return { status: 'ok', database: 'connected' };
  }

  getMcpHealth(): McpHealthResponse {
    return { status: 'ok', service: 'arcsyn-shift-mcp' };
  }
}
