import { describe, expect, it } from 'vitest';
import { HealthService } from '../src/application/health.service.js';

describe('HealthService', () => {
  it('returns the HTTP health contract', () =>
    expect(new HealthService().getHttpHealth()).toEqual({ status: 'ok', database: 'connected' }));
});
