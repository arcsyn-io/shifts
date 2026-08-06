import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

type VercelModule = typeof import('../vercel');

let vercelModule: VercelModule;

beforeAll(async () => {
  vi.stubEnv('API_PROXY_ORIGIN', 'https://api.test.invalid');
  vercelModule = await import('../vercel');
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe('Vercel web configuration', () => {
  it('proxies API requests before the SPA fallback', () => {
    expect(vercelModule.config.rewrites).toEqual([
      {
        source: '/api/:path*',
        destination: 'https://api.test.invalid/api/:path*',
      },
      {
        source: '/(.*)',
        destination: '/index.html',
      },
    ]);
  });

  it('fails configuration when API_PROXY_ORIGIN is absent', () => {
    expect(() => vercelModule.createVercelConfig({})).toThrow(
      'API_PROXY_ORIGIN must be configured with the API HTTPS origin',
    );
  });

  it.each([
    'http://api.test.invalid',
    '//api.test.invalid',
    'https:\\api.test.invalid',
    'https://user:password@api.test.invalid',
    'https://api.test.invalid/',
    'https://api.test.invalid/base-path',
    'https://api.test.invalid?tenant=one',
    'https://api.test.invalid#fragment',
  ])('rejects the invalid proxy origin %s', (configuredOrigin) => {
    expect(() => vercelModule.createVercelConfig({ API_PROXY_ORIGIN: configuredOrigin })).toThrow(
      'API_PROXY_ORIGIN must be an exact HTTPS origin',
    );
  });

  it('does not enable CDN caching for authentication routes', () => {
    expect(vercelModule.config).not.toHaveProperty('headers');
  });
});
