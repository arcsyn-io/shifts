import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchHealth } from '@/features/health/api/fetchHealth';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchHealth', () => {
  it('returns a response accepted by the shared contract', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok', database: 'connected' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchHealth()).resolves.toEqual({ status: 'ok', database: 'connected' });
    expect(fetchMock).toHaveBeenCalledWith('/api/health', undefined);
  });

  it('rejects a successful HTTP response outside the shared contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: 'degraded', database: 'unknown' }), {
          status: 200,
        }),
      ),
    );

    await expect(fetchHealth()).rejects.toThrow();
  });

  it('rejects an unsuccessful HTTP response before parsing it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

    await expect(fetchHealth()).rejects.toThrow('API unavailable');
  });
});
