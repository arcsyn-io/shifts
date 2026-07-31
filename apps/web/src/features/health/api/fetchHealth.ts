import { healthResponseSchema, type HealthResponse } from '@arcsyn-shift/contracts';
import { resolveHealthApiUrl } from '@/shared/config/api';

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(resolveHealthApiUrl(), signal ? { signal } : undefined);

  if (!response.ok) {
    throw new Error('API unavailable');
  }

  const body: unknown = await response.json();
  return healthResponseSchema.parse(body);
}
