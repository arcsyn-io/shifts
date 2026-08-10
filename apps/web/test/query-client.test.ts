import { describe, expect, it } from 'vitest';
import { createAppQueryClient, QUERY_STALE_TIME_MS } from '../src/shared/query/query-client';

describe('application query client', () => {
  it('keeps cached data fresh for thirty minutes without refetching every query on focus', () => {
    const queryClient = createAppQueryClient();

    expect(QUERY_STALE_TIME_MS).toBe(30 * 60 * 1_000);
    expect(queryClient.getDefaultOptions().queries).toMatchObject({
      staleTime: QUERY_STALE_TIME_MS,
      refetchOnWindowFocus: false,
    });
  });
});
