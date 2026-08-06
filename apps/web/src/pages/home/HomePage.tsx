import { PageHeader } from '@arcsyn-io/react';

export function HomePage() {
  return (
    <main className="home-page" data-arcsyn-theme="dark">
      <div className="home-page__content">
        <PageHeader>
          <PageHeader.Content>
            <PageHeader.Eyebrow>ArcSyn Shift</PageHeader.Eyebrow>
            <PageHeader.Title>Your workspace is ready.</PageHeader.Title>
            <PageHeader.Description>
              You are signed in. Shift planning tools will appear here as they become available.
            </PageHeader.Description>
          </PageHeader.Content>
        </PageHeader>
      </div>
    </main>
  );
}
