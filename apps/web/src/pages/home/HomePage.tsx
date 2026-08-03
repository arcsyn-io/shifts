import { PageHeader } from '@arcsyn-io/react';
import { HealthStatus } from '@/features/health';

export function HomePage() {
  return (
    <main className="home-page" data-arcsyn-theme="dark">
      <div className="home-page__content">
        <PageHeader>
          <PageHeader.Content>
            <PageHeader.Eyebrow>ArcSyn Shift</PageHeader.Eyebrow>
            <PageHeader.Title>Project foundation ready.</PageHeader.Title>
            <PageHeader.Description>
              Initial stack configuration is online. Product rules are intentionally not
              implemented.
            </PageHeader.Description>
          </PageHeader.Content>
        </PageHeader>
        <HealthStatus />
      </div>
    </main>
  );
}
