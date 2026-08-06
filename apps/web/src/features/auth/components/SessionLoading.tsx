import { Spinner } from '@arcsyn-io/react';

export function SessionLoading() {
  return (
    <main className="session-state" data-arcsyn-theme="dark">
      <div className="session-state__loading" role="status">
        <Spinner size="lg" />
        <span>Checking your session…</span>
      </div>
    </main>
  );
}
