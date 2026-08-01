import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type PackageManifest = {
  exports: {
    '.': {
      types: string;
      development: string;
      import: string;
      default: string;
    };
  };
};

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const packages = [
  { directory: 'config', runtimeEntry: './dist/index.js', typesEntry: './dist/index.d.ts' },
  { directory: 'contracts', runtimeEntry: './dist/index.js', typesEntry: './dist/index.d.ts' },
  {
    directory: 'database',
    runtimeEntry: './dist/src/index.js',
    typesEntry: './dist/src/index.d.ts',
  },
  {
    directory: 'observability',
    runtimeEntry: './dist/index.js',
    typesEntry: './dist/index.d.ts',
  },
] as const;

describe.each(packages)(
  '@arcsyn-shift/$directory exports',
  ({ directory, runtimeEntry, typesEntry }) => {
    it('separates development sources from production artifacts', async () => {
      const packageRoot = path.join(workspaceRoot, 'packages', directory);
      const manifest = JSON.parse(
        await readFile(path.join(packageRoot, 'package.json'), 'utf8'),
      ) as PackageManifest;

      expect(manifest.exports['.']).toEqual({
        types: typesEntry,
        development: './src/index.ts',
        import: runtimeEntry,
        default: runtimeEntry,
      });
      await expect(access(path.resolve(packageRoot, runtimeEntry))).resolves.toBeUndefined();
      await expect(access(path.resolve(packageRoot, typesEntry))).resolves.toBeUndefined();
    });
  },
);
