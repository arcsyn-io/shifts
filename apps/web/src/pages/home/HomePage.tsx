import { PageHeader } from '@arcsyn-io/react';
import { LogoutButton, useAuth } from '@/features/auth';
import { HealthStatus } from '@/features/health';

export function HomePage() {
  const auth = useAuth();

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
          <PageHeader.Metadata>
            <span className="home-page__user">Signed in as {auth.session?.user.email}</span>
          </PageHeader.Metadata>
          <PageHeader.Actions>
            <LogoutButton />
          </PageHeader.Actions>
        </PageHeader>
        <HealthStatus />
      </div>
    </main>
  );
}
