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

    await expect(
      readFile(path.join(moduleRoot, 'application/commands/.gitkeep'), 'utf8'),
    ).resolves.toBe('');
    await expect(
      readFile(path.join(moduleRoot, 'application/results/.gitkeep'), 'utf8'),
    ).resolves.toBe('');
    await expect(readFile(path.join(moduleRoot, 'domain/entities/.gitkeep'), 'utf8')).resolves.toBe(
      '',
    );
    await expect(
      readFile(path.join(moduleRoot, 'domain/use-cases/.gitkeep'), 'utf8'),
    ).resolves.toBe('');
    await expect(
      readFile(path.join(moduleRoot, 'domain/value-objects/.gitkeep'), 'utf8'),
    ).resolves.toBe('');
    await expect(
      readFile(path.join(moduleRoot, 'presentation/http/dto/.gitkeep'), 'utf8'),
    ).resolves.toBe('');
    await expect(
      readFile(path.join(moduleRoot, 'presentation/http/mappers/.gitkeep'), 'utf8'),
    ).resolves.toBe('');
    await expect(
      readFile(path.join(moduleRoot, 'presentation/mcp/dto/.gitkeep'), 'utf8'),
    ).resolves.toBe('');
    await expect(
      readFile(path.join(moduleRoot, 'presentation/mcp/mappers/.gitkeep'), 'utf8'),
    ).resolves.toBe('');
    await expect(
      readFile(path.join(moduleRoot, 'repository/mappers/.gitkeep'), 'utf8'),
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
      'modules/health/presentation/mcp/health-mcp.tool.ts',
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

  it('accepts only the approved context and transaction infrastructure contracts', async () => {
    const sourceRoot = await createTemporarySource();
    await createModule('organizations', { sourceRoot });
    await createModule('auth', { sourceRoot });
    await writeSource(
      sourceRoot,
      'modules/organizations/application/organizations.service.ts',
      "import { ApplicationContext } from '../../../infrastructure/context/application-context.js';\n" +
        "import { TransactionManager } from '../../../infrastructure/database/transaction-manager.js';\n" +
        "import { Transactional } from '../../../infrastructure/database/transactional.js';\n" +
        'export class OrganizationsService {}\n',
    );
    await writeSource(
      sourceRoot,
      'modules/auth/presentation/http/guards/bff-session.guard.ts',
      "import { ApplicationContextAuthenticator } from '../../../../../infrastructure/context/application-context.js';\n" +
        'export class BffSessionGuard {}\n',
    );

    await expect(checkArchitecture({ sourceRoot })).resolves.toEqual([]);
  });

  it('continues rejecting unapproved infrastructure imports from application', async () => {
    const sourceRoot = await createTemporarySource();
    await createModule('organizations', { sourceRoot });
    await writeSource(
      sourceRoot,
      'modules/organizations/application/organizations.service.ts',
      "import { DatabaseModule } from '../../../infrastructure/database/database.module.js';\n" +
        'export class OrganizationsService {}\n',
    );

    expect(await checkArchitecture({ sourceRoot })).toEqual([
      expect.stringContaining('application so pode importar os contratos transacionais'),
    ]);
  });

  it('rejects application context imports outside the authentication adapter', async () => {
    const sourceRoot = await createTemporarySource();
    await createModule('organizations', { sourceRoot });
    await writeSource(
      sourceRoot,
      'modules/organizations/presentation/http/organizations.controller.ts',
      "import { ApplicationContext } from '../../../../infrastructure/context/application-context.js';\n" +
        'export class OrganizationsController {}\n',
    );

    expect(await checkArchitecture({ sourceRoot })).toEqual([
      expect.stringContaining('contexto no adapter autenticador'),
    ]);
  });

  it.each(['ApplicationContextAuthenticator', 'ApplicationTransactionContext'])(
    'rejects the privileged capability %s from an application service',
    async (capability) => {
      const sourceRoot = await createTemporarySource();
      await createModule('organizations', { sourceRoot });
      await writeSource(
        sourceRoot,
        'modules/organizations/application/organizations.service.ts',
        `import { ${capability} } from '../../../infrastructure/context/application-context.js';\n` +
          'export class OrganizationsService {}\n',
      );

      expect(await checkArchitecture({ sourceRoot })).toEqual([
        expect.stringContaining(`${capability} e uma capability privilegiada`),
      ]);
    },
  );

  it('rejects direct database package access from application', async () => {
    const sourceRoot = await createTemporarySource();
    await createModule('organizations', { sourceRoot });
    await writeSource(
      sourceRoot,
      'modules/organizations/application/organizations.service.ts',
      "import { sql } from '@arcsyn-shift/database';\nexport class OrganizationsService {}\n",
    );

    expect(await checkArchitecture({ sourceRoot })).toEqual([
      expect.stringContaining('application deve acessar persistencia pelos repositories'),
    ]);
  });

  it.each(['Database', 'createDatabase', 'withPrincipalContext'])(
    'rejects privileged database API %s from a repository',
    async (identifier) => {
      const sourceRoot = await createTemporarySource();
      await createModule('organizations', { sourceRoot });
      await writeSource(
        sourceRoot,
        'modules/organizations/repository/organizations.repository.ts',
        `import { ${identifier} } from '@arcsyn-shift/database';\n` +
          'export class OrganizationsRepository {}\n',
      );

      expect(await checkArchitecture({ sourceRoot })).toEqual([
        expect.stringContaining(`${identifier} e acesso privilegiado`),
      ]);
    },
  );

  it('rejects the root database module from a repository', async () => {
    const sourceRoot = await createTemporarySource();
    await createModule('organizations', { sourceRoot });
    await writeSource(
      sourceRoot,
      'modules/organizations/repository/organizations.repository.ts',
      "import { DATABASE } from '../../../infrastructure/database/database.module.js';\n" +
        'export class OrganizationsRepository {}\n',
    );

    expect(await checkArchitecture({ sourceRoot })).toEqual(
      expect.arrayContaining([
        expect.stringContaining('DATABASE e acesso privilegiado'),
        expect.stringContaining('repository so pode importar o TransactionManager'),
      ]),
    );
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

  it('reports modular artifacts created outside src/modules', async () => {
    const sourceRoot = await createTemporarySource();
    await createModule('health', { sourceRoot });
    await writeSource(
      sourceRoot,
      'infrastructure/rogue.command.ts',
      'export class RogueCommand {}\n',
    );

    expect(await checkArchitecture({ sourceRoot })).toEqual([
      expect.stringContaining(
        'Command modular deve ficar em src/modules/<modulo>/application/commands',
      ),
    ]);
  });

  it('accepts the shared MCP controller and tool contract outside modules', async () => {
    const sourceRoot = await createTemporarySource();
    await createModule('health', { sourceRoot });
    await writeSource(
      sourceRoot,
      'infrastructure/mcp/mcp.controller.ts',
      'export class McpController {}\n',
    );
    await writeSource(
      sourceRoot,
      'infrastructure/mcp/mcp-tool.ts',
      'export interface McpTool {}\n',
    );

    await expect(checkArchitecture({ sourceRoot })).resolves.toEqual([]);
  });

  it('reports a stale .gitkeep beside real content', async () => {
    const sourceRoot = await createTemporarySource();
    await createModule('health', { sourceRoot });
    await writeSource(
      sourceRoot,
      'modules/health/domain/entities/health.entity.ts',
      'export class HealthEntity {}\n',
      { preserveGitkeep: true },
    );

    expect(await checkArchitecture({ sourceRoot })).toEqual([
      expect.stringContaining('domain/entities/.gitkeep: remova o .gitkeep'),
    ]);
  });

  it('accepts DTOs, commands, results and mappers in approved directories', async () => {
    const sourceRoot = await createTemporarySource();
    await createModule('shifts', { sourceRoot });
    const approvedArtifacts = [
      ['presentation/http/dto/create-shift.request.dto.ts', 'export class CreateShiftDto {}\n'],
      ['presentation/http/mappers/shift.mapper.ts', 'export class HttpShiftMapper {}\n'],
      ['presentation/mcp/dto/find-shift.response.dto.ts', 'export interface FindShiftDto {}\n'],
      ['presentation/mcp/mappers/shift.mapper.ts', 'export class McpShiftMapper {}\n'],
      ['application/commands/create-shift.command.ts', 'export class CreateShiftCommand {}\n'],
      ['application/results/create-shift.result.ts', 'export type CreateShiftResult = {};\n'],
      ['repository/mappers/shift.mapper.ts', 'export class ShiftRepositoryMapper {}\n'],
    ] as const;

    for (const [relativePath, source] of approvedArtifacts) {
      await writeSource(sourceRoot, `modules/shifts/${relativePath}`, source);
    }

    await expect(checkArchitecture({ sourceRoot })).resolves.toEqual([]);
  });

  it.each([
    {
      relativePath: 'domain/create-shift.request.dto.ts',
      source: 'export class CreateShiftDto {}\n',
      expected: 'DTO deve ficar em presentation/http/dto ou presentation/mcp/dto',
    },
    {
      relativePath: 'presentation/http/create-shift.command.ts',
      source: 'export class CreateShiftCommand {}\n',
      expected: 'Command deve ficar em application/commands',
    },
    {
      relativePath: 'application/create-shift.result.ts',
      source: 'export type CreateShiftResult = {};\n',
      expected: 'Result deve ficar em application/results',
    },
    {
      relativePath: 'application/shift.mapper.ts',
      source: 'export class ShiftMapper {}\n',
      expected:
        'Mapper deve ficar em presentation/http/mappers ou presentation/mcp/mappers ou repository/mappers',
    },
  ])(
    'reports $relativePath outside its approved directory',
    async ({ relativePath, source, expected }) => {
      const sourceRoot = await createTemporarySource();
      await createModule('shifts', { sourceRoot });
      await writeSource(sourceRoot, `modules/shifts/${relativePath}`, source);

      expect(await checkArchitecture({ sourceRoot })).toEqual(
        expect.arrayContaining([expect.stringContaining(expected)]),
      );
    },
  );

  it.each(['application/commands/internal/foo.ts', 'presentation/http/dto/internal/foo.ts'])(
    'reports a generic file nested below a reserved directory: %s',
    async (relativePath) => {
      const sourceRoot = await createTemporarySource();
      await createModule('shifts', { sourceRoot });
      await writeSource(sourceRoot, `modules/shifts/${relativePath}`, 'export class Foo {}\n');

      expect(await checkArchitecture({ sourceRoot })).not.toEqual([]);
    },
  );

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
    const fileNameByLayer: Record<string, string> = {
      application: 'invalid.service.ts',
      domain: 'invalid.ts',
      'presentation/http': 'invalid.controller.ts',
      repository: 'invalid.repository.ts',
    };
    await writeSource(sourceRoot, `modules/broken/${layer}/${fileNameByLayer[layer]}`, source);

    expect(await checkArchitecture({ sourceRoot })).toEqual([expect.stringContaining(expected)]);
  });

  it('reports internal imports between modules', async () => {
    const sourceRoot = await createTemporarySource();
    await createModule('first', { sourceRoot });
    await createModule('second', { sourceRoot });
    await writeSource(
      sourceRoot,
      'modules/first/application/invalid.service.ts',
      "import { Other } from '../../second/domain/other.js';\n",
    );

    expect(await checkArchitecture({ sourceRoot })).toEqual([
      expect.stringContaining('nao pode importar caminho interno do modulo "second"'),
    ]);
  });

  it('allows an explicit public module entry while preserving internal boundaries', async () => {
    const sourceRoot = await createTemporarySource();
    await createModule('first', { sourceRoot });
    await createModule('second', { sourceRoot });
    await writeSource(
      sourceRoot,
      'modules/second/index.ts',
      "export { SecondModule } from './second.module.js';\n",
    );
    await writeSource(
      sourceRoot,
      'modules/first/application/valid.service.ts',
      "import { SecondModule } from '../../second/index.js';\nexport class ValidService {}\n",
    );

    await expect(checkArchitecture({ sourceRoot })).resolves.toEqual([]);
  });

  it('reports a DTO class whose file does not declare request or response', async () => {
    const sourceRoot = await createTemporarySource();
    await createModule('shifts', { sourceRoot });
    await writeSource(
      sourceRoot,
      'modules/shifts/presentation/http/dto/create-shift.ts',
      'export class CreateShiftDto {}\n',
    );

    expect(await checkArchitecture({ sourceRoot })).toEqual([
      expect.stringContaining('DTO deve usar *.request.dto.ts ou *.response.dto.ts'),
    ]);
  });

  it.each([
    ['application/commands/create-shift.ts', 'export class CreateShiftCommand {}\n', 'Command'],
    [
      'application/results/createShift.result.ts',
      'export type CreateShiftResult = {};\n',
      'Result',
    ],
    ['presentation/http/mappers/shift.ts', 'export class ShiftMapper {}\n', 'Mapper'],
    ['domain/entities/shift.ts', 'export class ShiftEntity {}\n', 'Entity'],
  ] as const)(
    'reports an invalid file name inside a reserved directory: %s',
    async (relativePath, source, artifactName) => {
      const sourceRoot = await createTemporarySource();
      await createModule('shifts', { sourceRoot });
      await writeSource(sourceRoot, `modules/shifts/${relativePath}`, source);

      expect(await checkArchitecture({ sourceRoot })).toEqual([
        expect.stringContaining(`${artifactName} deve usar`),
      ]);
    },
  );

  it.each([
    ['application/commands/shift.service.ts', 'export class ShiftService {}\n', 'Service'],
    [
      'presentation/http/dto/shift.controller.ts',
      'export class ShiftController {}\n',
      'Controller',
    ],
  ] as const)(
    'reports an architectural class nested outside its exact directory: %s',
    async (relativePath, source, artifactName) => {
      const sourceRoot = await createTemporarySource();
      await createModule('shifts', { sourceRoot });
      await writeSource(sourceRoot, `modules/shifts/${relativePath}`, source);

      expect(await checkArchitecture({ sourceRoot })).toEqual(
        expect.arrayContaining([expect.stringContaining(`${artifactName} deve ficar em`)]),
      );
    },
  );

  it('accepts architectural classes in their approved layers', async () => {
    const sourceRoot = await createTemporarySource();
    await createModule('shifts', { sourceRoot });
    const approvedClasses = [
      ['presentation/http/shift.controller.ts', 'export class ShiftController {}\n'],
      ['presentation/mcp/shift-mcp.tool.ts', 'export class ShiftMcpTool {}\n'],
      ['application/shift.service.ts', 'export class ShiftService {}\n'],
      ['domain/use-cases/create-shift.use-case.ts', 'export class CreateShiftUseCase {}\n'],
      ['domain/entities/shift.entity.ts', 'export class ShiftEntity {}\n'],
      ['domain/value-objects/shift-code.value-object.ts', 'export class ShiftCodeValueObject {}\n'],
      ['repository/shift.repository.ts', 'export class ShiftRepository {}\n'],
    ] as const;

    for (const [relativePath, source] of approvedClasses) {
      await writeSource(sourceRoot, `modules/shifts/${relativePath}`, source);
    }

    await expect(checkArchitecture({ sourceRoot })).resolves.toEqual([]);
  });

  it.each([
    ['application/shift.controller.ts', 'export class ShiftController {}\n', 'Controller'],
    ['application/shift.tool.ts', 'export class ShiftMcpTool {}\n', 'McpTool'],
    ['domain/shift.service.ts', 'export class ShiftService {}\n', 'Service'],
    ['domain/create-shift.use-case.ts', 'export class CreateShiftUseCase {}\n', 'UseCase'],
    ['domain/shift.entity.ts', 'export class ShiftEntity {}\n', 'Entity'],
    ['domain/shift-code.value-object.ts', 'export class ShiftCodeValueObject {}\n', 'ValueObject'],
    ['application/shift.repository.ts', 'export class ShiftRepository {}\n', 'Repository'],
  ] as const)(
    'reports %s outside its approved layer',
    async (relativePath, source, artifactName) => {
      const sourceRoot = await createTemporarySource();
      await createModule('shifts', { sourceRoot });
      await writeSource(sourceRoot, `modules/shifts/${relativePath}`, source);

      expect(await checkArchitecture({ sourceRoot })).toEqual(
        expect.arrayContaining([expect.stringContaining(`${artifactName} deve ficar em`)]),
      );
    },
  );
});
