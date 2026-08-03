import { Alert, Button } from '@arcsyn-io/react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { isSessionRejected, logout } from '@/features/auth/api/authApi';
import { useAuth } from '@/features/auth/model/AuthProvider';

export function LogoutButton() {
  const auth = useAuth();
  const navigate = useNavigate();
  const logoutMutation = useMutation({
    mutationFn: async () => {
      if (!auth.session) return;
      await logout(auth.session.csrfToken);
    },
  });

  const signOut = async () => {
    try {
      await logoutMutation.mutateAsync();
      auth.setSession(null);
      navigate('/login', { replace: true });
    } catch (error) {
      if (isSessionRejected(error)) {
        auth.setSession(null);
        navigate('/login', { replace: true });
      }
    }
  };

  return (
    <div className="logout-control">
      <Button
        type="button"
        variant="outline"
        loading={logoutMutation.isPending}
        disabled={logoutMutation.isPending}
        onClick={() => void signOut()}
      >
        {logoutMutation.isPending ? 'Signing out' : 'Sign out'}
      </Button>
      {logoutMutation.isError && !isSessionRejected(logoutMutation.error) ? (
        <Alert
          variant="danger"
          title="Sign-out failed"
          description="Your session is still active. Check your connection and try again."
          aria-live="polite"
        />
      ) : null}
    </div>
  );
}
