import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const config = readFileSync('supabase/config.toml', 'utf8');
const supabaseIgnore = readFileSync('supabase/.gitignore', 'utf8');

function section(name) {
  const escapedName = name.replaceAll('.', '\\.');
  const match = config.match(new RegExp(`^\\[${escapedName}\\]\\n([\\s\\S]*?)(?=^\\[|\\Z)`, 'm'));

  assert.ok(match, `seção [${name}] ausente em supabase/config.toml`);
  return match[1];
}

function setting(sectionName, name) {
  const match = section(sectionName).match(new RegExp(`^${name}\\s*=\\s*(.+)$`, 'm'));

  assert.ok(match, `configuração ${sectionName}.${name} ausente`);
  return match[1].trim();
}

test('fixa a Supabase CLI aprovada e preserva comandos operacionais seguros', () => {
  assert.equal(packageJson.devDependencies.supabase, '2.111.0');
  assert.equal(
    execFileSync('pnpm', ['exec', 'supabase', '--version'], { encoding: 'utf8' }).trim(),
    '2.111.0',
  );

  const start = packageJson.scripts['supabase:start'];
  assert.match(
    start,
    /^pnpm supabase:network && node supabase\/scripts\/run-redacted\.mjs start --network-id shifts-supabase /,
  );
  for (const service of [
    'realtime',
    'storage-api',
    'imgproxy',
    'edge-runtime',
    'logflare',
    'vector',
    'supavisor',
    'postgrest',
  ]) {
    assert.match(start, new RegExp(`(?:-x |,)${service}(?:,|$)`));
  }

  assert.doesNotMatch(packageJson.scripts['supabase:stop'], /--no-backup|--all/);
  assert.equal(
    packageJson.scripts['infra:reset'],
    'supabase db reset && pnpm db:migrate && pnpm auth:seed',
  );
  assert.equal(packageJson.scripts['auth:seed'], 'node supabase/scripts/seed-local-user.mjs');
  assert.equal(
    packageJson.scripts['supabase:status'],
    'node supabase/scripts/run-redacted.mjs status',
  );
  assert.doesNotMatch(JSON.stringify(packageJson.scripts), /--no-backup|docker compose down -v/);
});

test('mantém Auth e PostgreSQL no Supabase sem migrations concorrentes', () => {
  assert.equal(setting('db', 'major_version'), '17');
  assert.equal(setting('db.migrations', 'enabled'), 'false');
  assert.equal(setting('db.seed', 'enabled'), 'false');
  assert.equal(setting('auth', 'enabled'), 'true');
  assert.equal(setting('auth', 'enable_signup'), 'false');
  assert.equal(setting('auth.email', 'enable_signup'), 'true');
  assert.equal(setting('auth.oauth_server', 'allow_dynamic_registration'), 'false');
});

test('desabilita capacidades não adotadas', () => {
  for (const name of [
    'realtime',
    'storage',
    'storage.s3_protocol',
    'storage.vector',
    'edge_runtime',
    'analytics',
  ]) {
    assert.equal(setting(name, 'enabled'), 'false', `${name} deveria estar desabilitado`);
  }
});

test('preserva arquivos locais e chaves privadas fora do Git', () => {
  for (const ignored of ['.branches', '.temp', '.env.local', '.env.*.local', 'signing_keys.json']) {
    assert.match(supabaseIgnore, new RegExp(`^${ignored.replaceAll('.', '\\.')}\\s*$`, 'm'));
  }

  for (const name of ['openai_api_key', 'auth_token', 's3_access_key', 's3_secret_key']) {
    const assignments = [...config.matchAll(new RegExp(`^${name}\\s*=\\s*"([^"]*)"`, 'gm'))];
    assert.ok(assignments.length > 0, `configuração ${name} ausente`);
    for (const [, value] of assignments) {
      assert.match(value, /^(?:|env\([A-Z][A-Z0-9_]*\))$/);
    }
  }
});

test('mantém somente MinIO no Compose e restringe portas ao loopback', () => {
  execFileSync('docker', ['compose', 'config', '--quiet'], { stdio: 'pipe' });
  const compose = JSON.parse(
    execFileSync('docker', ['compose', 'config', '--format', 'json'], { encoding: 'utf8' }),
  );

  assert.deepEqual(Object.keys(compose.services).sort(), ['minio', 'minio-init']);
  assert.equal(compose.services.minio.volumes[0].source, 'minio-data');
  assert.deepEqual(
    compose.services.minio.ports.map(({ host_ip: hostIp, published }) => [hostIp, published]),
    [
      ['127.0.0.1', '9000'],
      ['127.0.0.1', '9001'],
    ],
  );
});
