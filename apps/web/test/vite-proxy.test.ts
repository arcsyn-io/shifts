import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('Vite development proxy', () => {
  it('proxies the same-origin API without exposing MCP through the web origin', async () => {
    const source = await readFile(path.join(webRoot, 'vite.config.ts'), 'utf8');

    expect(source).toContain("proxy: { '/api': 'http://localhost:3000' }");
    expect(source).not.toContain("'/mcp'");
  });

  it('keeps the authenticated API rewrite before the SPA fallback on Vercel', async () => {
    const config = JSON.parse(
      await readFile(path.join(webRoot, 'vercel.json'), 'utf8'),
    ) as { rewrites: Array<Record<string, unknown>> };

    expect(config.rewrites).toEqual([
      {
        source: '/api/:path*',
        destination: '$API_PROXY_ORIGIN/api/:path*',
        env: ['API_PROXY_ORIGIN'],
        respectOriginCacheControl: false,
      },
      { source: '/(.*)', destination: '/index.html' },
    ]);
    expect(JSON.stringify(config)).not.toContain('/mcp');
  });
});
