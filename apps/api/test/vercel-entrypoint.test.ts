import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('Vercel NestJS entrypoint', () => {
  it('keeps the conventional bootstrap without module exports', async () => {
    const source = await readFile(path.join(apiRoot, 'src/main.ts'), 'utf8');

    expect(source).not.toMatch(/^export\s/m);
    expect(source).not.toContain("process.env.NODE_ENV !== 'test'");
    expect(source.trimEnd()).toMatch(/bootstrap\(\);$/);
  });

  it('uses the zero-config NestJS build', async () => {
    const config = JSON.parse(await readFile(path.join(apiRoot, 'vercel.json'), 'utf8')) as Record<
      string,
      unknown
    >;

    expect(config.framework).toBe('nestjs');
    expect(config.installCommand).toBe(
      "cd ../.. && corepack pnpm@9.15.5 install --frozen-lockfile --filter . --filter '@arcsyn-shift/api...' && corepack pnpm@9.15.5 exec turbo run build --filter='@arcsyn-shift/api^...'",
    );
    expect(config).not.toHaveProperty('buildCommand');
    expect(config).not.toHaveProperty('outputDirectory');
  });
});
