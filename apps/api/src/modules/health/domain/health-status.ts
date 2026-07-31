export type HealthState = 'ok';

export class HealthStatus {
  private constructor(readonly value: HealthState) {}

  static available(): HealthStatus {
    return new HealthStatus('ok');
  }
}
