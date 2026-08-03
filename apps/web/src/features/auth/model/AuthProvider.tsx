import type { AuthSessionResponse } from '@arcsyn-shift/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, type PropsWithChildren } from 'react';
import { fetchSessionWithRefresh } from '@/features/auth/api/authApi';

const authSessionQueryKey = ['auth', 'session'] as const;

interface AuthContextValue {
  session: AuthSessionResponse | null | undefined;
  isPending: boolean;
  isError: boolean;
  retry: () => void;
  setSession: (session: AuthSessionResponse | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const sessionQuery = useQuery({
    queryKey: authSessionQueryKey,
    queryFn: ({ signal }) => fetchSessionWithRefresh(signal),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const value: AuthContextValue = {
    session: sessionQuery.data,
    isPending: sessionQuery.isPending,
    isError: sessionQuery.isError,
    retry: () => {
      void sessionQuery.refetch();
    },
    setSession: (session) => {
      queryClient.setQueryData(authSessionQueryKey, session);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) throw new Error('useAuth must be used inside AuthProvider');

  return context;
}
