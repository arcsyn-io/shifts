import { readdir, readFile } from 'node:fs/promises';
import { builtinModules } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts']);
const LAYER_LEVELS = new Map([
  ['app', 0],
  ['pages', 1],
  ['features', 2],
  ['shared', 3],
]);
const SERVER_ONLY_IMPORTS = [
  '@arcsyn-shift/config',
  '@arcsyn-shift/database',
  '@arcsyn-shift/observability',
];
const MAIN_EXTERNAL_IMPORTS = new Set(['react', 'react-dom/client', '@arcsyn-io/react/styles.css']);
const MAIN_INTERNAL_LAYERS = new Set(['app', 'shared']);
const NODE_BUILTIN_IMPORTS = new Set(
  builtinModules.map((specifier) => specifier.replace(/^node:/, '')),
);

const normalize = (value) => value.split(path.sep).join('/');

async function listSourceFiles(directory) {
  const files = [];

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listSourceFiles(target)));
    else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) files.push(target);
  }

  return files;
}

function extractImports(relativeFile, source) {
  const imports = [];
  const errors = [];
  const sourceFile = ts.createSourceFile(relativeFile, source, ts.ScriptTarget.Latest, true);

  const addLiteral = (node, kind) => {
    if (node && ts.isStringLiteralLike(node)) {
      imports.push(node.text);
      return;
    }

    errors.push(`${relativeFile}: ${kind} deve usar um caminho estatico literal.`);
  };

  const visit = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      addLiteral(node.moduleSpecifier, 'import/export');
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      addLiteral(node.moduleReference.expression, 'import');
    } else if (ts.isCallExpression(node)) {
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';

      if (isDynamicImport || isRequire) {
        addLiteral(node.arguments[0], isDynamicImport ? 'import dinamico' : 'require');
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return { imports, errors };
}

function resolveInternalImport(relativeFile, specifier) {
  if (specifier.startsWith('@/')) return path.posix.normalize(specifier.slice(2));
  if (!specifier.startsWith('.')) return undefined;
  return path.posix.normalize(path.posix.join(path.posix.dirname(relativeFile), specifier));
}

function validateImport(relativeFile, specifier) {
  const target = resolveInternalImport(relativeFile, specifier);
  const errors = [];

  if (
    specifier.startsWith('node:') ||
    NODE_BUILTIN_IMPORTS.has(specifier) ||
    SERVER_ONLY_IMPORTS.some(
      (serverOnlyImport) =>
        specifier === serverOnlyImport || specifier.startsWith(`${serverOnlyImport}/`),
    )
  ) {
    errors.push(`${relativeFile}: o browser nao pode importar o pacote server-only ${specifier}.`);
  }

  if (!target) {
    if (relativeFile === 'main.tsx' && !MAIN_EXTERNAL_IMPORTS.has(specifier)) {
      errors.push(
        `${relativeFile}: import externo nao permitido na raiz de composicao (${specifier}).`,
      );
    }
    return errors;
  }

  if (target === '..' || target.startsWith('../')) {
    errors.push(`${relativeFile}: o import ${specifier} escapa de src.`);
    return errors;
  }

  const [sourceLayer, sourceFeature] = relativeFile.split('/');
  const [targetLayer, targetFeature, ...targetFeaturePath] = target.split('/');
  const sourceLevel = LAYER_LEVELS.get(sourceLayer);
  const targetLevel = LAYER_LEVELS.get(targetLayer);

  if (relativeFile === 'main.tsx' && !MAIN_INTERNAL_LAYERS.has(targetLayer)) {
    errors.push(
      `${relativeFile}: a raiz de composicao so pode importar app ou shared (${specifier}).`,
    );
  }

  if (sourceLevel !== undefined && targetLevel !== undefined && targetLevel < sourceLevel) {
    errors.push(
      `${relativeFile}: a camada ${sourceLayer} nao pode importar a camada superior ${targetLayer} (${specifier}).`,
    );
  }

  if (
    sourceLayer === 'features' &&
    targetLayer === 'features' &&
    sourceFeature !== targetFeature &&
    targetFeaturePath.length > 0 &&
    !(targetFeaturePath.length === 1 && /^index(?:\.[cm]?tsx?)?$/.test(targetFeaturePath[0]))
  ) {
    errors.push(
      `${relativeFile}: a feature "${sourceFeature}" nao pode importar caminho interno da feature "${targetFeature}" (${specifier}); use o index.ts publico.`,
    );
  }

  return errors;
}

export async function checkArchitecture(options = {}) {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const sourceRoot = options.sourceRoot ?? path.join(scriptDirectory, '../src');
  const errors = [];

  for (const file of await listSourceFiles(sourceRoot)) {
    const relativeFile = normalize(path.relative(sourceRoot, file));

    const sourceLayer = relativeFile.split('/')[0];
    if (relativeFile !== 'main.tsx' && !LAYER_LEVELS.has(sourceLayer)) {
      errors.push(
        `${relativeFile}: arquivos de src devem ficar em app, pages, features ou shared.`,
      );
      continue;
    }

    const source = await readFile(file, 'utf8');
    const extracted = extractImports(relativeFile, source);
    errors.push(...extracted.errors);
    for (const specifier of extracted.imports) {
      errors.push(...validateImport(relativeFile, specifier));
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
    process.stdout.write('Arquitetura do web validada com sucesso.\n');
  }
}
