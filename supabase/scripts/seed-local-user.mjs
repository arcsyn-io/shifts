import { execFileSync } from 'node:child_process';

const defaultEmail = 'usuario.local@shifts.invalid';
const defaultPassword = 'LocalOnly-ChangeMe123!';

function readSupabaseStatus() {
  let output;

  try {
    output = execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'env'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    throw new Error('Supabase local não está saudável; execute pnpm infra:up antes do seed.');
  }

  return Object.fromEntries(
    output
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z0-9_]+)="?(.*?)"?$/))
      .filter(Boolean)
      .map((match) => [match[1], match[2]]),
  );
}

async function request(url, serviceRoleKey, path, init = {}) {
  const response = await fetch(new URL(path, url), {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
      ...init.headers,
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Auth Admin respondeu ${response.status}: ${detail}`);
  }

  return response.json();
}

async function main() {
  const status = readSupabaseStatus();
  const apiUrl = status.API_URL;
  const serviceRoleKey = status.SERVICE_ROLE_KEY;

  if (!apiUrl || !serviceRoleKey) {
    throw new Error('A saída de supabase status não contém API_URL e SERVICE_ROLE_KEY.');
  }

  const email = process.env.SUPABASE_SEED_EMAIL ?? defaultEmail;
  const password = process.env.SUPABASE_SEED_PASSWORD ?? defaultPassword;
  const users = await request(apiUrl, serviceRoleKey, '/auth/v1/admin/users?page=1&per_page=1000');

  if (users.users?.some((user) => user.email === email)) {
    process.stdout.write(`Usuário local já existe: ${email}\n`);
    return;
  }

  await request(apiUrl, serviceRoleKey, '/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  process.stdout.write(`Usuário local criado: ${email}\n`);
}

await main();
