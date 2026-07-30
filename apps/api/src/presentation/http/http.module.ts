import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { HealthService } from '../../application/health.service.js';

@Module({ controllers: [HealthController], providers: [HealthService], exports: [HealthService] })
export class HttpModule {}
