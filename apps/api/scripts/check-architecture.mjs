import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const REQUIRED_DIRECTORIES = [
  'application',
  'domain',
  'presentation/http',
  'presentation/mcp',
  'repository',
];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts']);
const MODULE_NAME_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const IMPORT_PATTERN =
  /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|require\s*\(\s*["']([^"']+)["']\s*\)/g;
const SHARED_ARTIFACT_EXCEPTIONS = new Set([
  'infrastructure/mcp/mcp.controller.ts',
  'infrastructure/mcp/mcp-tool.ts',
]);
const ARTIFACT_RULES = [
  {
    name: 'DTO',
    filePattern: /\.dto\.(?:ts|tsx|mts|cts)$/i,
    identifierSuffixes: ['Dto'],
    allowedDirectories: ['presentation/http/dto', 'presentation/mcp/dto'],
    forbidSubdirectories: true,
    requiredFilePattern:
      /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.(?:request|response)\.dto\.(?:ts|tsx|mts|cts)$/,
    requiredFileMessage: 'DTO deve usar *.request.dto.ts ou *.response.dto.ts',
  },
  {
    name: 'Command',
    filePattern: /\.command\.(?:ts|tsx|mts|cts)$/i,
    identifierSuffixes: ['Command'],
    allowedDirectories: ['application/commands'],
    forbidSubdirectories: true,
    requiredFilePattern: /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.command\.(?:ts|tsx|mts|cts)$/,
    requiredFileMessage: 'Command deve usar <nome-em-kebab-case>.command.ts',
  },
  {
    name: 'Result',
    filePattern: /\.result\.(?:ts|tsx|mts|cts)$/i,
    identifierSuffixes: ['Result'],
    allowedDirectories: ['application/results'],
    forbidSubdirectories: true,
    requiredFilePattern: /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.result\.(?:ts|tsx|mts|cts)$/,
    requiredFileMessage: 'Result deve usar <nome-em-kebab-case>.result.ts',
  },
  {
    name: 'Mapper',
    filePattern: /\.mapper\.(?:ts|tsx|mts|cts)$/i,
    identifierSuffixes: ['Mapper'],
    allowedDirectories: [
      'presentation/http/mappers',
      'presentation/mcp/mappers',
      'repository/mappers',
    ],
    forbidSubdirectories: true,
    requiredFilePattern: /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.mapper\.(?:ts|tsx|mts|cts)$/,
    requiredFileMessage: 'Mapper deve usar <nome-em-kebab-case>.mapper.ts',
  },
  {
    name: 'Controller',
    filePattern: /\.controller\.(?:ts|tsx|mts|cts)$/i,
    identifierSuffixes: ['Controller'],
    allowedDirectories: ['presentation/http'],
    requiredFilePattern: /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.controller\.(?:ts|tsx|mts|cts)$/,
    requiredFileMessage: 'Controller deve usar <nome-em-kebab-case>.controller.ts',
  },
  {
    name: 'McpTool',
    filePattern: /\.tool\.(?:ts|tsx|mts|cts)$/i,
    identifierSuffixes: ['McpTool'],
    allowedDirectories: ['presentation/mcp'],
    requiredFilePattern: /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*-mcp\.tool\.(?:ts|tsx|mts|cts)$/,
    requiredFileMessage: 'McpTool deve usar <nome-em-kebab-case>-mcp.tool.ts',
  },
  {
    name: 'Service',
    filePattern: /\.service\.(?:ts|tsx|mts|cts)$/i,
    identifierSuffixes: ['Service'],
    allowedDirectories: ['application'],
    requiredFilePattern: /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.service\.(?:ts|tsx|mts|cts)$/,
    requiredFileMessage: 'Service deve usar <nome-em-kebab-case>.service.ts',
  },
  {
    name: 'UseCase',
    filePattern: /\.use-case\.(?:ts|tsx|mts|cts)$/i,
    identifierSuffixes: ['UseCase'],
    allowedDirectories: ['domain/use-cases'],
    forbidSubdirectories: true,
    requiredFilePattern: /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.use-case\.(?:ts|tsx|mts|cts)$/,
    requiredFileMessage: 'UseCase deve usar <nome-em-kebab-case>.use-case.ts',
  },
  {
    name: 'Entity',
    filePattern: /\.entity\.(?:ts|tsx|mts|cts)$/i,
    identifierSuffixes: ['Entity'],
    allowedDirectories: ['domain/entities'],
    forbidSubdirectories: true,
    requiredFilePattern: /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.entity\.(?:ts|tsx|mts|cts)$/,
    requiredFileMessage: 'Entity deve usar <nome-em-kebab-case>.entity.ts',
  },
  {
    name: 'ValueObject',
    filePattern: /\.value-object\.(?:ts|tsx|mts|cts)$/i,
    identifierSuffixes: ['ValueObject'],
    allowedDirectories: ['domain/value-objects'],
    forbidSubdirectories: true,
    requiredFilePattern: /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.value-object\.(?:ts|tsx|mts|cts)$/,
    requiredFileMessage: 'ValueObject deve usar <nome-em-kebab-case>.value-object.ts',
  },
  {
    name: 'Repository',
    filePattern: /\.repository\.(?:ts|tsx|mts|cts)$/i,
    identifierSuffixes: ['Repository'],
    allowedDirectories: ['repository'],
    requiredFilePattern: /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.repository\.(?:ts|tsx|mts|cts)$/,
    requiredFileMessage: 'Repository deve usar <nome-em-kebab-case>.repository.ts',
  },
];

const normalize = (value) => value.split(path.sep).join('/');

const toPascalCase = (name) =>
  name
    .split('-')
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join('');

async function listEntries(directory) {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

async function listSourceFiles(directory) {
  const files = [];

  for (const entry of await listEntries(directory)) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listSourceFiles(target)));
    else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) files.push(target);
  }

  return files;
}

async function findDirectories(directory, expectedName) {
  const matches = [];

  for (const entry of await listEntries(directory)) {
    if (!entry.isDirectory()) continue;
    const target = path.join(directory, entry.name);
    if (entry.name === expectedName) matches.push(target);
    matches.push(...(await findDirectories(target, expectedName)));
  }

  return matches;
}

async function findStaleGitkeeps(directory) {
  const staleGitkeeps = [];
  const entries = await listEntries(directory);

  if (
    entries.some((entry) => entry.isFile() && entry.name === '.gitkeep') &&
    entries.some((entry) => entry.name !== '.gitkeep')
  ) {
    staleGitkeeps.push(path.join(directory, '.gitkeep'));
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      staleGitkeeps.push(...(await findStaleGitkeeps(path.join(directory, entry.name))));
    }
  }

  return staleGitkeeps;
}

function extractImports(source) {
  const imports = [];
  for (const match of source.matchAll(IMPORT_PATTERN)) {
    imports.push(match[1] ?? match[2] ?? match[3]);
  }
  return imports;
}

function validateArtifactLocation(relativeFile, source, moduleName) {
  const errors = [];
  const modulePrefix = `modules/${moduleName}/`;
  const moduleRelativePath = relativeFile.slice(modulePrefix.length);
  const fileDirectory = path.posix.dirname(moduleRelativePath);
  const fileName = path.posix.basename(moduleRelativePath);

  for (const rule of ARTIFACT_RULES) {
    const declarationPattern = new RegExp(
      `\\b(?:abstract\\s+)?(?:class|interface|type|enum)\\s+[A-Za-z_$][\\w$]*(?:${rule.identifierSuffixes.join('|')})\\b`,
    );
    const isInReservedDirectory = rule.allowedDirectories.includes(fileDirectory);
    const isBelowReservedDirectory =
      rule.forbidSubdirectories === true &&
      rule.allowedDirectories.some((directory) => fileDirectory.startsWith(`${directory}/`));
    const matchesArtifact =
      rule.filePattern.test(fileName) ||
      declarationPattern.test(source) ||
      isInReservedDirectory ||
      isBelowReservedDirectory;

    if (!matchesArtifact) continue;

    const isAllowed = isInReservedDirectory;
    if (!isAllowed) {
      errors.push(
        `${relativeFile}: ${rule.name} deve ficar em ${rule.allowedDirectories.join(' ou ')}.`,
      );
    }
    if (rule.requiredFilePattern && !rule.requiredFilePattern.test(fileName)) {
      errors.push(`${relativeFile}: ${rule.requiredFileMessage}.`);
    }
  }

  return errors;
}

function validateArtifactsOutsideModules(relativeFile, source) {
  if (
    relativeFile.startsWith('modules/') ||
    relativeFile.startsWith('application/') ||
    relativeFile.startsWith('presentation/') ||
    SHARED_ARTIFACT_EXCEPTIONS.has(relativeFile)
  ) {
    return [];
  }

  const fileName = path.posix.basename(relativeFile);
  const errors = [];

  for (const rule of ARTIFACT_RULES) {
    const declarationPattern = new RegExp(
      `\\b(?:abstract\\s+)?(?:class|interface|type|enum)\\s+[A-Za-z_$][\\w$]*(?:${rule.identifierSuffixes.join('|')})\\b`,
    );
    if (!rule.filePattern.test(fileName) && !declarationPattern.test(source)) continue;

    errors.push(
      `${relativeFile}: ${rule.name} modular deve ficar em src/modules/<modulo>/${rule.allowedDirectories.join(' ou ')}.`,
    );
  }

  return errors;
}

function resolveImport(importer, specifier, sourceRoot) {
  if (specifier.startsWith('.')) {
    return normalize(path.relative(sourceRoot, path.resolve(path.dirname(importer), specifier)));
  }
  if (specifier.startsWith('src/')) return specifier.slice(4);
  if (specifier.startsWith('/')) return normalize(path.relative(sourceRoot, specifier));
  return null;
}

const moduleFromPath = (relativePath) => {
  const match = relativePath.match(/^modules\/([^/]+)(?:\/|$)/);
  return match?.[1] ?? null;
};

const layerFromPath = (relativePath, moduleName) => {
  const match = relativePath.match(
    new RegExp(`^modules/${moduleName}/(application|domain|presentation|repository)(?:/|$)`),
  );
  return match?.[1] ?? null;
};

function validateImport({ file, specifier, sourceRoot, moduleName, layer }) {
  const errors = [];
  const relativeFile = normalize(path.relative(sourceRoot, file));
  const resolved = resolveImport(file, specifier, sourceRoot);
  const importedModule = resolved ? moduleFromPath(resolved) : null;

  if (importedModule && importedModule !== moduleName) {
    const isPublicModuleEntry = resolved === `modules/${importedModule}/index.js`;
    if (isPublicModuleEntry) return errors;
    errors.push(
      `${relativeFile}: nao pode importar caminho interno do modulo "${importedModule}" (${specifier}).`,
    );
    return errors;
  }

  const importedLayer =
    resolved && importedModule === moduleName ? layerFromPath(resolved, moduleName) : null;

  if (layer === 'domain') {
    const forbiddenPackage =
      specifier.startsWith('@nestjs/') ||
      specifier === '@arcsyn-shift/database' ||
      specifier.startsWith('@arcsyn-shift/database/') ||
      specifier === 'pg' ||
      specifier.startsWith('drizzle-');
    const forbiddenPath =
      (importedLayer !== null && importedLayer !== 'domain') ||
      resolved?.startsWith('infrastructure/') ||
      resolved?.includes('/infrastructure/');

    if (forbiddenPackage || forbiddenPath) {
      errors.push(
        `${relativeFile}: domain deve permanecer isolado de NestJS, infraestrutura e persistencia (${specifier}).`,
      );
    }
  }

  if (
    layer === 'presentation' &&
    importedLayer &&
    !['presentation', 'application'].includes(importedLayer)
  ) {
    errors.push(
      `${relativeFile}: presentation so pode depender de application dentro do modulo (${specifier}).`,
    );
  }

  if (
    layer === 'presentation' &&
    resolved?.startsWith('infrastructure/') &&
    !resolved.startsWith('infrastructure/mcp/mcp-tool')
  ) {
    errors.push(
      `${relativeFile}: presentation so pode importar da infraestrutura o contrato MCP compartilhado (${specifier}).`,
    );
  }

  if (
    layer === 'application' &&
    importedLayer &&
    !['application', 'domain', 'repository'].includes(importedLayer)
  ) {
    errors.push(
      `${relativeFile}: application so pode depender de domain ou repository dentro do modulo (${specifier}).`,
    );
  }

  if (layer === 'application' && resolved?.startsWith('infrastructure/')) {
    errors.push(
      `${relativeFile}: application nao pode depender da infraestrutura compartilhada (${specifier}).`,
    );
  }

  if (
    layer === 'repository' &&
    importedLayer &&
    importedLayer !== 'domain' &&
    importedLayer !== 'repository'
  ) {
    errors.push(
      `${relativeFile}: repository so pode depender de domain dentro do modulo (${specifier}).`,
    );
  }

  if (
    layer === 'repository' &&
    resolved &&
    !importedLayer &&
    !resolved.startsWith('infrastructure/')
  ) {
    errors.push(
      `${relativeFile}: repository so pode usar domain e infraestrutura compartilhada (${specifier}).`,
    );
  }

  return errors;
}

export async function checkArchitecture(options = {}) {
  const sourceRoot = path.resolve(options.sourceRoot ?? path.join(process.cwd(), 'src'));
  const modulesRoot = path.join(sourceRoot, 'modules');
  const errors = [];
  const moduleEntries = (await listEntries(modulesRoot)).filter((entry) => entry.isDirectory());

  if (moduleEntries.length === 0) {
    errors.push('src/modules deve conter ao menos um modulo.');
  }

  for (const legacyLayer of ['application', 'presentation']) {
    for (const file of await listSourceFiles(path.join(sourceRoot, legacyLayer))) {
      errors.push(
        `${normalize(path.relative(sourceRoot, file))}: camada global antiga nao e permitida; mova o arquivo para src/modules/<modulo>.`,
      );
    }
  }

  for (const file of await listSourceFiles(sourceRoot)) {
    const relativeFile = normalize(path.relative(sourceRoot, file));
    const source = await readFile(file, 'utf8');
    errors.push(...validateArtifactsOutsideModules(relativeFile, source));
  }

  for (const entry of moduleEntries) {
    const moduleName = entry.name;
    const moduleRoot = path.join(modulesRoot, moduleName);
    const allEntries = await listEntries(moduleRoot);

    const hasValidModuleName = MODULE_NAME_PATTERN.test(moduleName);
    if (!hasValidModuleName) {
      errors.push(`modules/${moduleName}: nome de diretorio invalido; use kebab-case.`);
    }

    for (const requiredDirectory of REQUIRED_DIRECTORIES) {
      const target = path.join(moduleRoot, requiredDirectory);
      const parentEntries = await listEntries(path.dirname(target));
      const expectedName = path.basename(target);
      if (
        !parentEntries.some(
          (candidate) => candidate.isDirectory() && candidate.name === expectedName,
        )
      ) {
        errors.push(`modules/${moduleName}: diretorio obrigatorio ausente: ${requiredDirectory}.`);
      }
    }

    for (const nestedInfrastructure of await findDirectories(moduleRoot, 'infrastructure')) {
      errors.push(
        `modules/${moduleName}: infrastructure deve ficar fora dos modulos (${normalize(path.relative(moduleRoot, nestedInfrastructure))}).`,
      );
    }

    const expectedModuleFile = `${moduleName}.module.ts`;
    const hasExpectedModuleFile = allEntries.some(
      (candidate) => candidate.isFile() && candidate.name === expectedModuleFile,
    );
    if (!hasExpectedModuleFile) {
      errors.push(`modules/${moduleName}: arquivo obrigatorio ausente: ${expectedModuleFile}.`);
    } else if (hasValidModuleName) {
      const moduleSource = await readFile(path.join(moduleRoot, expectedModuleFile), 'utf8');
      const expectedClass = `${toPascalCase(moduleName)}Module`;
      const exportedClassPattern = new RegExp(`\\bexport\\s+class\\s+${expectedClass}\\b`);
      if (!exportedClassPattern.test(moduleSource)) {
        errors.push(
          `modules/${moduleName}/${expectedModuleFile}: deve exportar a classe ${expectedClass}.`,
        );
      }
    }

    for (const staleGitkeep of await findStaleGitkeeps(moduleRoot)) {
      errors.push(
        `${normalize(path.relative(sourceRoot, staleGitkeep))}: remova o .gitkeep porque o diretorio ja possui conteudo real.`,
      );
    }

    for (const file of await listSourceFiles(moduleRoot)) {
      const relativeFile = normalize(path.relative(sourceRoot, file));
      const layer = layerFromPath(relativeFile, moduleName);
      const source = await readFile(file, 'utf8');

      errors.push(...validateArtifactLocation(relativeFile, source, moduleName));

      for (const specifier of extractImports(source)) {
        errors.push(...validateImport({ file, specifier, sourceRoot, moduleName, layer }));
      }
    }
  }

  return errors;
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const errors = await checkArchitecture();
  if (errors.length > 0) {
    process.stderr.write('Validacao arquitetural falhou:\n');
    for (const error of errors) process.stderr.write(`- ${error}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write('Arquitetura da API validada com sucesso.\n');
  }
}
