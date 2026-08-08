import { Card, StatusIndicator } from '@arcsyn-io/react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fetchHealth } from '@/features/health/api/fetchHealth';

export function HealthStatus() {
  const { t } = useTranslation('status');
  const health = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => fetchHealth(signal),
  });

  const indicatorStatus = health.isPending ? 'loading' : health.isError ? 'danger' : 'success';
  const status = health.isPending
    ? t('health.checking')
    : health.isError
      ? t('health.unavailable')
      : t(`health.${health.data.status}`);

  return (
    <Card className="health-status" padding="compact" role="status" aria-live="polite" aria-atomic>
      <StatusIndicator status={indicatorStatus} format="pill" label={`API: ${status}`} />
    </Card>
  );
}
