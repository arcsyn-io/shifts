import { Injectable } from '@nestjs/common';
import type { HealthResponse, McpHealthResponse } from '@arcsyn-shift/contracts';
import { CheckHealthUseCase } from '../domain/check-health.use-case.js';

@Injectable()
export class HealthService {
  constructor(private readonly checkHealth: CheckHealthUseCase) {}

  getHttpHealth(): HealthResponse {
    return { status: this.checkHealth.execute().value, database: 'connected' };
  }

  getMcpHealth(): McpHealthResponse {
    return { status: this.checkHealth.execute().value, service: 'arcsyn-shift-mcp' };
  }
}
