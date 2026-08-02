import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from '../../application/health.service.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Check API and database availability' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  getHealth() {
    return this.healthService.getHttpHealth();
  }
}
