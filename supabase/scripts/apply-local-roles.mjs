import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const databaseRequire = createRequire(
  new URL('../../packages/database/package.json', import.meta.url),
);
const { config } = databaseRequire('dotenv');
const { Client } = databaseRequire('pg');

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
config({ path: `${repositoryRoot}/.env` });

const connectionString = process.env.DATABASE_MIGRATION_URL;
if (!connectionString) {
  throw new Error('DATABASE_MIGRATION_URL é obrigatória para provisionar roles locais.');
}

const databaseUrl = new URL(connectionString);
if (!['127.0.0.1', 'localhost'].includes(databaseUrl.hostname) || databaseUrl.port !== '54322') {
  throw new Error('O provisionamento de roles locais só pode usar o PostgreSQL Supabase local.');
}

const sql = await readFile(new URL('../roles.sql', import.meta.url), 'utf8');
const client = new Client({ connectionString });

try {
  await client.connect();
  await client.query(sql);
  process.stdout.write('Roles locais da aplicação verificadas.\n');
  const runtimeUrl = process.env.DATABASE_URL;
  if (runtimeUrl && new URL(runtimeUrl).username === 'postgres') {
    process.stderr.write(
      'Aviso: atualize DATABASE_URL para arcsyn_shift_app_local conforme .env.example.\n',
    );
  }
} finally {
  await client.end();
}
