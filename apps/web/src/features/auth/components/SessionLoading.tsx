import { Spinner } from '@arcsyn-io/react';
import { useTranslation } from 'react-i18next';

export function SessionLoading() {
  const { t } = useTranslation('auth');

  return (
    <main className="session-state">
      <div className="session-state__loading" role="status">
        <Spinner size="lg" />
        <span>{t('loading')}</span>
      </div>
    </main>
  );
}
