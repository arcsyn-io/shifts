import { spawnSync } from 'node:child_process';

const sensitiveNames = ['SECRET_KEY', 'JWT_SECRET', 'ANON_KEY', 'SERVICE_ROLE_KEY'];

function redact(value = '') {
  let result = value;

  for (const name of sensitiveNames) {
    result = result
      .replace(new RegExp(`("${name}"\\s*:\\s*")[^"]*(")`, 'g'), '$1[redacted]$2')
      .replace(new RegExp(`(^|\\n)(${name}=)"?[^"]*"?(?=\\n|$)`, 'g'), '$1$2[redacted]');
  }

  return result;
}

const [, , ...supabaseArgs] = process.argv;

if (supabaseArgs.length === 0) {
  throw new Error('Informe o comando da Supabase CLI.');
}

const result = spawnSync('pnpm', ['exec', 'supabase', ...supabaseArgs], {
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
});

process.stdout.write(redact(result.stdout));
process.stderr.write(redact(result.stderr));

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
