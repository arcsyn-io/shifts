import { DataState } from '@arcsyn-io/react';
import { Navigate } from 'react-router-dom';
import { LoginForm, useAuth } from '@/features/auth';

export function LoginPage() {
  const auth = useAuth();

  if (auth.isPending) {
    return (
      <main className="auth-state-page" data-arcsyn-theme="dark">
        <DataState
          state="loading"
          size="full"
          title="Checking your session"
          loadingLabel="Checking your session"
        />
      </main>
    );
  }

  if (!auth.isError && auth.session) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="login-page" data-arcsyn-theme="dark">
      <div className="login-page__content">
        {auth.isError ? (
          <p className="login-page__notice" role="status">
            Session status is temporarily unavailable. You can still sign in.
          </p>
        ) : null}
        <LoginForm />
      </div>
    </main>
  );
}
