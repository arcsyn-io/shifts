import { PageHeader } from '@arcsyn-io/react';
import { useTranslation } from 'react-i18next';
import { HealthStatus } from '@/features/health';

export function StatusPage() {
  const { t } = useTranslation('status');

  return (
    <main className="home-page">
      <div className="home-page__content">
        <PageHeader>
          <PageHeader.Content>
            <PageHeader.Eyebrow>{t('header.eyebrow')}</PageHeader.Eyebrow>
            <PageHeader.Title>{t('header.title')}</PageHeader.Title>
            <PageHeader.Description>{t('header.description')}</PageHeader.Description>
          </PageHeader.Content>
        </PageHeader>
        <HealthStatus />
      </div>
    </main>
  );
}
