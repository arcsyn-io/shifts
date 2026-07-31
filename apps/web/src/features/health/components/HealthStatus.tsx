import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from '@/features/health/api/fetchHealth';

export function HealthStatus() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => fetchHealth(signal),
  });

  const status = health.isPending
    ? 'checking…'
    : health.isError
      ? 'unavailable'
      : health.data.status;

  return (
    <div className="status" role="status" aria-live="polite">
      API: {status}
    </div>
  );
}
