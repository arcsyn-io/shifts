import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkArchitecture } from '../scripts/check-architecture.mjs';

const temporaryDirectories: string[] = [];

async function createTemporarySource() {
  const root = await mkdtemp(path.join(tmpdir(), 'arcsyn-web-architecture-'));
  temporaryDirectories.push(root);
  const sourceRoot = path.join(root, 'src');
  await mkdir(sourceRoot);
  return sourceRoot;
}

async function writeSource(sourceRoot: string, relativePath: string, source: string) {
  const target = path.join(sourceRoot, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, source);
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('checkArchitecture', () => {
  it('accepts the current web architecture', async () => {
    await expect(checkArchitecture()).resolves.toEqual([]);
  });

  it('accepts imports that follow the app to shared direction', async () => {
    const sourceRoot = await createTemporarySource();
    await writeSource(sourceRoot, 'app/App.tsx', "import { Page } from '@/pages/home/Page';\n");
    await writeSource(
      sourceRoot,
      'pages/home/Page.tsx',
      "import { Feature } from '@/features/health';\n",
    );
    await writeSource(
      sourceRoot,
      'features/health/index.ts',
      "export { api } from '@/shared/config/api';\n",
    );
    await writeSource(sourceRoot, 'shared/config/api.ts', 'export const api = {};\n');

    await expect(checkArchitecture({ sourceRoot })).resolves.toEqual([]);
  });

  it('reports a lower layer importing a higher layer', async () => {
    const sourceRoot = await createTemporarySource();
    await writeSource(
      sourceRoot,
      'shared/config/invalid.ts',
      "import { HomePage } from '@/pages/home/HomePage';\n",
    );

    expect(await checkArchitecture({ sourceRoot })).toEqual([
      expect.stringContaining('shared nao pode importar a camada superior pages'),
    ]);
  });

  it.each(['js', 'jsx', 'mjs', 'cjs'])(
    'checks JavaScript source files with .%s',
    async (extension) => {
      const sourceRoot = await createTemporarySource();
      await writeSource(
        sourceRoot,
        `shared/invalid.${extension}`,
        "import { HomePage } from '@/pages/home/HomePage';\n",
      );

      expect(await checkArchitecture({ sourceRoot })).toEqual([
        expect.stringContaining('shared nao pode importar a camada superior pages'),
      ]);
    },
  );

  it('reports internal imports between features', async () => {
    const sourceRoot = await createTemporarySource();
    await writeSource(
      sourceRoot,
      'features/shifts/components/Shift.tsx',
      "import { fetchHealth } from '@/features/health/api/fetchHealth';\n",
    );

    expect(await checkArchitecture({ sourceRoot })).toEqual([
      expect.stringContaining('nao pode importar caminho interno da feature "health"'),
    ]);
  });

  it('normalizes aliases before checking internal imports between features', async () => {
    const sourceRoot = await createTemporarySource();
    await writeSource(
      sourceRoot,
      'features/shifts/components/Shift.tsx',
      "import { secret } from '@/features/health/../auth/api/secret';\n",
    );

    expect(await checkArchitecture({ sourceRoot })).toEqual([
      expect.stringContaining('nao pode importar caminho interno da feature "auth"'),
    ]);
  });

  it('checks dynamic imports written with a literal template', async () => {
    const sourceRoot = await createTemporarySource();
    await writeSource(
      sourceRoot,
      'shared/invalid.ts',
      'const page = import(`@/pages/home/HomePage`);\n',
    );

    expect(await checkArchitecture({ sourceRoot })).toEqual([
      expect.stringContaining('shared nao pode importar a camada superior pages'),
    ]);
  });

  it('rejects dynamic imports whose target cannot be checked statically', async () => {
    const sourceRoot = await createTemporarySource();
    await writeSource(
      sourceRoot,
      'features/health/api/invalid.ts',
      'const moduleName = "health"; import(`@/features/${moduleName}`);\n',
    );

    expect(await checkArchitecture({ sourceRoot })).toEqual([
      expect.stringContaining('import dinamico deve usar um caminho estatico literal'),
    ]);
  });

  it('ignores import-like text inside comments and strings', async () => {
    const sourceRoot = await createTemporarySource();
    await writeSource(
      sourceRoot,
      'shared/example.ts',
      [
        "// import { HomePage } from '@/pages/home/HomePage';",
        'const example = "import(\'@/pages/home/HomePage\')";',
      ].join('\n'),
    );

    await expect(checkArchitecture({ sourceRoot })).resolves.toEqual([]);
  });

  it('accepts the public index of another feature', async () => {
    const sourceRoot = await createTemporarySource();
    await writeSource(
      sourceRoot,
      'features/shifts/components/Shift.tsx',
      "import { HealthStatus } from '@/features/health';\n",
    );

    await expect(checkArchitecture({ sourceRoot })).resolves.toEqual([]);
  });

  it.each(["import value from '../../../../outside';\n", "import value from '@/../outside';\n"])(
    'reports an import that escapes src',
    async (source) => {
      const sourceRoot = await createTemporarySource();
      await writeSource(sourceRoot, 'features/health/api/invalid.ts', source);

      expect(await checkArchitecture({ sourceRoot })).toEqual([
        expect.stringContaining('escapa de src'),
      ]);
    },
  );

  it.each([
    '@arcsyn-shift/config',
    '@arcsyn-shift/database/internal',
    '@arcsyn-shift/observability',
    'node:fs',
    'fs',
    'path',
    'process',
  ])('reports the server-only import %s', async (specifier) => {
    const sourceRoot = await createTemporarySource();
    await writeSource(
      sourceRoot,
      'features/health/api/invalid.ts',
      `import value from '${specifier}';\n`,
    );

    expect(await checkArchitecture({ sourceRoot })).toEqual([
      expect.stringContaining('server-only'),
    ]);
  });

  it('checks the main entrypoint against its composition allowlist', async () => {
    const sourceRoot = await createTemporarySource();
    await writeSource(
      sourceRoot,
      'main.tsx',
      "import { HomePage } from '@/pages/home/HomePage';\n",
    );

    expect(await checkArchitecture({ sourceRoot })).toEqual([
      expect.stringContaining('so pode importar app ou shared'),
    ]);
  });

  it('rejects unexpected external imports from the main entrypoint', async () => {
    const sourceRoot = await createTemporarySource();
    await writeSource(
      sourceRoot,
      'main.tsx',
      "import { useQuery } from '@tanstack/react-query';\n",
    );

    expect(await checkArchitecture({ sourceRoot })).toEqual([
      expect.stringContaining('import externo nao permitido'),
    ]);
  });
});
