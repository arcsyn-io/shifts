import { Button, DataState } from '@arcsyn-io/react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/model/AuthProvider';

export function ProtectedRoute() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.isPending) {
    return (
      <main className="auth-state-page" data-arcsyn-theme="dark">
        <DataState
          state="loading"
          size="full"
          title="Restoring your session"
          loadingLabel="Restoring your session"
        />
      </main>
    );
  }

  if (auth.isError) {
    return (
      <main className="auth-state-page" data-arcsyn-theme="dark">
        <DataState
          state="error"
          size="full"
          title="We could not restore your session"
          description="Check your connection and try again."
          action={<Button onClick={auth.retry}>Try again</Button>}
        />
      </main>
    );
  }

  if (!auth.session) {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" replace state={{ from }} />;
  }

  return <Outlet />;
}
