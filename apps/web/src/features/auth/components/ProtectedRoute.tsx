import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthRequestError } from '@/features/auth/api/auth';
import { SessionLoading } from '@/features/auth/components/SessionLoading';
import { SessionUnavailable } from '@/features/auth/components/SessionUnavailable';
import { createLoginRedirect } from '@/features/auth/model/redirect';
import { useSessionQuery } from '@/features/auth/queries/session';

export function ProtectedRoute() {
  const location = useLocation();
  const session = useSessionQuery();

  if (session.isPending) return <SessionLoading />;

  if (session.error instanceof AuthRequestError && session.error.status === 401) {
    return (
      <Navigate
        to={createLoginRedirect(location.pathname, location.search, location.hash)}
        replace
      />
    );
  }

  if (session.isError) {
    return (
      <SessionUnavailable onRetry={() => void session.refetch()} isRetrying={session.isFetching} />
    );
  }

  return <Outlet />;
}
