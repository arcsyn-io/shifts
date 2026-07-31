import { describe, expect, it } from 'vitest';
import { HealthService } from '../src/modules/health/application/health.service.js';
import { CheckHealthUseCase } from '../src/modules/health/domain/check-health.use-case.js';

describe('HealthService', () => {
  it('returns the HTTP health contract', () =>
    expect(new HealthService(new CheckHealthUseCase()).getHttpHealth()).toEqual({
      status: 'ok',
      database: 'connected',
    }));
});
