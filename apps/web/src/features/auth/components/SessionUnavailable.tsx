import { Alert, Button, Card } from '@arcsyn-io/react';
import { useTranslation } from 'react-i18next';

interface SessionUnavailableProps {
  onRetry: () => void;
  isRetrying: boolean;
}

export function SessionUnavailable({ onRetry, isRetrying }: SessionUnavailableProps) {
  const { t } = useTranslation(['auth', 'common']);

  return (
    <main className="session-state">
      <Card className="session-state__card">
        <Alert
          variant="danger"
          title={t('unavailable.title', { ns: 'auth' })}
          description={t('unavailable.description', { ns: 'auth' })}
        />
        <Button type="button" onClick={onRetry} loading={isRetrying}>
          {t('actions.retry', { ns: 'common' })}
        </Button>
      </Card>
    </main>
  );
}
