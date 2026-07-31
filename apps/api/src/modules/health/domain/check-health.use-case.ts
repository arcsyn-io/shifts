import { HealthStatus } from './health-status.js';

export class CheckHealthUseCase {
  execute(): HealthStatus {
    return HealthStatus.available();
  }
}
