import { useQuery } from '@tanstack/react-query';
import { fetchSession } from '@/features/auth/api/auth';

export const sessionQueryKey = ['auth', 'session'] as const;

export function useSessionQuery() {
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: ({ signal }) => fetchSession(signal),
    retry: false,
    staleTime: 30_000,
  });
}
