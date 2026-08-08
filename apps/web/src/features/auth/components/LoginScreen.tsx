import { Navigate, useLocation } from 'react-router-dom';
import { AuthRequestError } from '@/features/auth/api/auth';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { LoginHero } from '@/features/auth/components/LoginHero';
import { SessionLoading } from '@/features/auth/components/SessionLoading';
import { SessionUnavailable } from '@/features/auth/components/SessionUnavailable';
import { resolveSafeRedirect } from '@/features/auth/model/redirect';
import { useSessionQuery } from '@/features/auth/queries/session';

export function LoginScreen() {
  const location = useLocation();
  const destination = resolveSafeRedirect(location.search);
  const session = useSessionQuery();

  if (session.isPending) return <SessionLoading />;
  if (session.isSuccess) return <Navigate to={destination} replace />;

  if (!(session.error instanceof AuthRequestError && session.error.status === 401)) {
    return (
      <SessionUnavailable onRetry={() => void session.refetch()} isRetrying={session.isFetching} />
    );
  }

  return (
    <main className="login-page">
      <LoginForm destination={destination} />
      <LoginHero />
    </main>
  );
}
