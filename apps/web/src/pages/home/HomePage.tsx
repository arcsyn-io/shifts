import { PageHeader } from '@arcsyn-io/react';
import { useTranslation } from 'react-i18next';
import { OrganizationHome } from '@/features/organizations';
import { ApplicationShell } from '@/pages/layouts/ApplicationShell';

export function HomePage() {
  const { t } = useTranslation('home');

  return (
    <ApplicationShell activeArea="home" contextTitle={t('topbar.overview')}>
      <main className="home-page">
        <PageHeader>
          <PageHeader.Content>
            <PageHeader.Eyebrow>{t('header.eyebrow')}</PageHeader.Eyebrow>
            <PageHeader.Title>{t('header.title')}</PageHeader.Title>
            <PageHeader.Description>{t('header.description')}</PageHeader.Description>
          </PageHeader.Content>
        </PageHeader>
        <OrganizationHome />
      </main>
    </ApplicationShell>
  );
}
