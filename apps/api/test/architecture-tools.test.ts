import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkArchitecture } from '../scripts/check-architecture.mjs';
import { createModule } from '../scripts/create-module.mjs';

const temporaryDirectories: string[] = [];

const createTemporarySource = async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'arcsyn-api-architecture-'));
  temporaryDirectories.push(root);
  const sourceRoot = path.join(root, 'src');
  await mkdir(sourceRoot);
  return sourceRoot;
};

const writeSource = async (
  sourceRoot: string,
  relativePath: string,
  source: string,
  options: { preserveGitkeep?: boolean } = {},
) => {
  const target = path.join(sourceRoot, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  if (!options.preserveGitkeep) {
    await rm(path.join(path.dirname(target), '.gitkeep'), { force: true });
  }
  await writeFile(target, source);
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('createModule', () => {
  it('creates the mandatory modular structure', async () => {
    const sourceRoot = await createTemporarySource();

    const moduleRoot = await createModule('work-shifts', { sourceRoot });

    await expect(readFile(path.join(moduleRoot, 'application/.gitkeep'), 'utf8')).resolves.toBe('');
    await expect(readFile(path.join(moduleRoot, 'domain/.gitkeep'), 'utf8')).resolves.toBe('');
    await expect(readFile(path.join(moduleRoot, 'repository/.gitkeep'), 'utf8')).resolves.toBe('');
    await expect(
      readFile(path.join(moduleRoot, 'presentation/http/.gitkeep'), 'utf8'),
    ).resolves.toBe('');
    await expect(
      readFile(path.join(moduleRoot, 'presentation/mcp/.gitkeep'), 'utf8'),
    ).resolves.toBe('');
    await expect(
      readFile(path.join(moduleRoot, 'work-shifts.module.ts'), 'utf8'),
    ).resolves.toContain('export class WorkShiftsModule {}');
  });

  it.each(['WorkShifts', 'work_shifts', '../work-shifts', '1-work-shifts'])(
    'rejects the invalid module name %s',
    async (name) => {
      const sourceRoot = await createTemporarySource();
      await expect(createModule(name, { sourceRoot })).rejects.toThrow('Nome de modulo invalido');
    },
  );

  it('does not overwrite an existing module', async () => {
    const sourceRoot = await createTemporarySource();
    await createModule('health', { sourceRoot });

    await expect(createModule('health', { sourceRoot })).rejects.toThrow(
      'O modulo "health" ja existe.',
    );
  });
});

describe('checkArchitecture', () => {
  it('accepts a valid module and the shared MCP contract exception', async () => {
    const sourceRoot = await createTemporarySource();
    await createModule('health', { sourceRoot });
    await writeSource(
      sourceRoot,
      'modules/health/presentation/mcp/health.tool.ts',
      "import type { McpTool } from '../../../../infrastructure/mcp/mcp-tool.js';\n" +
        "import { HealthService } from '../../application/health.service.js';\n" +
        'export class HealthTool implements McpTool {}\n',
    );
    await writeSource(
      sourceRoot,
      'modules/health/application/health.service.ts',
      "import { HealthStatus } from '../domain/health-status.js';\nexport class HealthService {}\n",
    );
    await writeSource(
      sourceRoot,
      'modules/health/domain/health-status.ts',
      'export class HealthStatus {}\n',
    );

    await expect(checkArchitecture({ sourceRoot })).resolves.toEqual([]);
  });

  it('reports missing structure, nested infrastructure and module file', async () => {
    const sourceRoot = await createTemporarySource();
    await mkdir(path.join(sourceRoot, 'modules/broken/infrastructure'), { recursive: true });

    const errors = await checkArchitecture({ sourceRoot });

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('diretorio obrigatorio ausente: application'),
        expect.stringContaining('infrastructure deve ficar fora dos modulos'),
        expect.stringContaining('arquivo obrigatorio ausente: broken.module.ts'),
      ]),
    );
  });

  it('reports module directory names outside kebab-case', async () => {
    const sourceRoot = await createTemporarySource();
    const validModule = await createModule('valid-name', { sourceRoot });
    const invalidModule = path.join(sourceRoot, 'modules/InvalidName');
    await mkdir(invalidModule);
    for (const directory of [
      'application',
      'domain',
      'presentation/http',
      'presentation/mcp',
      'repository',
    ]) {
      await mkdir(path.join(invalidModule, directory), { recursive: true });
    }
    await writeFile(
      path.join(invalidModule, 'InvalidName.module.ts'),
      'export class InvalidNameModule {}\n',
    );
    expect(validModule).toBeTruthy();

    expect(await checkArchitecture({ sourceRoot })).toEqual([
      expect.stringContaining('nome de diretorio invalido; use kebab-case'),
    ]);
  });

  it('reports a module file with an unexpected exported class', async () => {
    const sourceRoot = await createTemporarySource();
    const moduleRoot = await createModule('work-shifts', { sourceRoot });
    await writeFile(
      path.join(moduleRoot, 'work-shifts.module.ts'),
      'export class WrongModule {}\n',
    );

    expect(await checkArchitecture({ sourceRoot })).toEqual([
      expect.stringContaining('deve exportar a classe WorkShiftsModule'),
    ]);
  });

  it('reports source files in legacy global layers', async () => {
    const sourceRoot = await createTemporarySource();
    await createModule('health', { sourceRoot });
    await writeSource(sourceRoot, 'application/legacy.service.ts', 'export class Legacy {}\n');
    await writeSource(
      sourceRoot,
      'presentation/http/legacy.controller.ts',
      'export class LegacyController {}\n',
    );

    expect(await checkArchitecture({ sourceRoot })).toEqual(
      expect.arrayContaining([
        expect.stringContaining('application/legacy.service.ts: camada global antiga'),
        expect.stringContaining('presentation/http/legacy.controller.ts: camada global antiga'),
      ]),
    );
  });

  it('reports a stale .gitkeep beside real content', async () => {
    const sourceRoot = await createTemporarySource();
    await createModule('health', { sourceRoot });
    await writeSource(
      sourceRoot,
      'modules/health/domain/health-status.ts',
      'export class HealthStatus {}\n',
      { preserveGitkeep: true },
    );

    expect(await checkArchitecture({ sourceRoot })).toEqual([
      expect.stringContaining('domain/.gitkeep: remova o .gitkeep'),
    ]);
  });

  it.each([
    {
      layer: 'domain',
      source: "import { Injectable } from '@nestjs/common';\n",
      expected: 'domain deve permanecer isolado',
    },
    {
      layer: 'domain',
      source: "import { Controller } from '../presentation/http/controller.js';\n",
      expected: 'domain deve permanecer isolado',
    },
    {
      layer: 'presentation/http',
      source: "import { Entity } from '../../domain/entity.js';\n",
      expected: 'presentation so pode depender de application',
    },
    {
      layer: 'application',
      source: "import { Controller } from '../presentation/http/controller.js';\n",
      expected: 'application so pode depender de domain ou repository',
    },
    {
      layer: 'repository',
      source: "import { Controller } from '../presentation/http/controller.js';\n",
      expected: 'repository so pode depender de domain',
    },
  ])('reports an invalid import from $layer', async ({ layer, source, expected }) => {
    const sourceRoot = await createTemporarySource();
    await createModule('broken', { sourceRoot });
    await writeSource(sourceRoot, `modules/broken/${layer}/invalid.ts`, source);

    expect(await checkArchitecture({ sourceRoot })).toEqual([expect.stringContaining(expected)]);
  });

  it('reports internal imports between modules', async () => {
    const sourceRoot = await createTemporarySource();
    await createModule('first', { sourceRoot });
    await createModule('second', { sourceRoot });
    await writeSource(
      sourceRoot,
      'modules/first/application/invalid.ts',
      "import { Other } from '../../second/domain/other.js';\n",
    );

    expect(await checkArchitecture({ sourceRoot })).toEqual([
      expect.stringContaining('nao pode importar caminho interno do modulo "second"'),
    ]);
  });
});
