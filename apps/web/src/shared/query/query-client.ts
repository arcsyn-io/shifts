import { QueryClient } from '@tanstack/react-query';

export const QUERY_STALE_TIME_MS = 30 * 60 * 1_000;

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE_TIME_MS,
        refetchOnWindowFocus: false,
      },
    },
  });
}
