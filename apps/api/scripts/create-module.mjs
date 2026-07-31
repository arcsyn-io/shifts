import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const MODULE_NAME_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const REQUIRED_DIRECTORIES = [
  'application',
  'domain',
  'presentation/http',
  'presentation/mcp',
  'repository',
];

const toPascalCase = (name) =>
  name
    .split('-')
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join('');

export async function createModule(name, options = {}) {
  if (!MODULE_NAME_PATTERN.test(name)) {
    throw new Error('Nome de modulo invalido. Use kebab-case, iniciando por uma letra minuscula.');
  }

  const sourceRoot = path.resolve(options.sourceRoot ?? path.join(process.cwd(), 'src'));
  const modulesRoot = path.join(sourceRoot, 'modules');
  const moduleRoot = path.join(modulesRoot, name);

  await mkdir(modulesRoot, { recursive: true });

  try {
    await mkdir(moduleRoot);
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new Error(`O modulo "${name}" ja existe.`);
    }
    throw error;
  }

  try {
    await Promise.all(
      REQUIRED_DIRECTORIES.map(async (directory) => {
        const target = path.join(moduleRoot, directory);
        await mkdir(target, { recursive: true });
        await writeFile(path.join(target, '.gitkeep'), '');
      }),
    );

    const className = `${toPascalCase(name)}Module`;
    const moduleFile = [
      "import { Module } from '@nestjs/common';",
      '',
      '@Module({})',
      `export class ${className} {}`,
      '',
    ].join('\n');

    await writeFile(path.join(moduleRoot, `${name}.module.ts`), moduleFile);
  } catch (error) {
    await rm(moduleRoot, { recursive: true, force: true });
    throw error;
  }

  return moduleRoot;
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const [, , ...args] = process.argv;

  if (args.length !== 1) {
    process.stderr.write('Uso: pnpm module:create <nome-em-kebab-case>\n');
    process.exitCode = 1;
  } else {
    try {
      const moduleRoot = await createModule(args[0]);
      process.stdout.write(`Modulo criado em ${path.relative(process.cwd(), moduleRoot)}.\n`);
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    }
  }
}
