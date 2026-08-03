import 'reflect-metadata';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { loadProvisioningConfig } from '@arcsyn-shift/config';
import { loginRequestSchema } from '@arcsyn-shift/contracts';

const MAX_PASSWORD_BYTES = 4096;

export function validateProvisionInput(
  email: string,
  password: string,
): {
  email: string;
  password: string;
} {
  if (password.length < 12) throw new Error('Password must contain at least 12 characters');
  const result = loginRequestSchema.safeParse({ email, password });
  if (!result.success) throw new Error('Invalid email or password');
  return result.data;
}

export async function readPipedPassword(
  input: AsyncIterable<Uint8Array | string>,
): Promise<string> {
  let value = '';
  for await (const chunk of input) {
    value += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    if (Buffer.byteLength(value, 'utf8') > MAX_PASSWORD_BYTES) {
      throw new Error('Password input is too large');
    }
  }
  const withoutFinalNewline = value.replace(/\r?\n$/, '');
  if (/\r|\n/.test(withoutFinalNewline)) throw new Error('Password must be a single line');
  return withoutFinalNewline;
}

export async function provisionUserWithDependencies(
  input: { email: string; password: string },
  dependencies: {
    hashPassword(password: string): Promise<string>;
    createUser(email: string, passwordHash: string): Promise<unknown>;
  },
): Promise<void> {
  const passwordHash = await dependencies.hashPassword(input.password);
  await dependencies.createUser(input.email, passwordHash);
}

async function readInteractivePassword(): Promise<string> {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error('Password must be provided through stdin');
  }
  process.stderr.write('Password: ');
  process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf8');
  process.stdin.resume();

  return new Promise((resolve, reject) => {
    let password = '';
    const restore = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('data', onData);
      process.stderr.write('\n');
    };
    const onData = (chunk: string) => {
      if (chunk === '\u0003') {
        restore();
        reject(new Error('Provisioning cancelled'));
        return;
      }
      if (chunk === '\r' || chunk === '\n') {
        restore();
        resolve(password);
        return;
      }
      if (chunk === '\u007f') {
        password = password.slice(0, -1);
        return;
      }
      password += chunk;
      if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
        restore();
        reject(new Error('Password input is too large'));
      }
    };
    process.stdin.on('data', onData);
  });
}

async function main(): Promise<void> {
  const arguments_ = process.argv.slice(2);
  if (arguments_.length !== 1 || !arguments_[0]) {
    throw new Error('Usage: pnpm auth:provision <email> (password is read from stdin)');
  }
  const password = process.stdin.isTTY
    ? await readInteractivePassword()
    : await readPipedPassword(process.stdin);
  const input = validateProvisionInput(arguments_[0], password);
  const config = loadProvisioningConfig();
  const [{ createDatabase }, { AuthRepository }, { PasswordService }] = await Promise.all([
    import('@arcsyn-shift/database'),
    import('../src/modules/auth/repository/auth.repository.js'),
    import('../src/modules/auth/application/password.service.js'),
  ]);
  const connection = createDatabase(config.DATABASE_PROVISIONING_URL);
  const repository = new AuthRepository(connection.db);
  const passwordService = new PasswordService();
  try {
    await provisionUserWithDependencies(input, {
      hashPassword: (plainPassword) => passwordService.hash(plainPassword),
      createUser: (email, passwordHash) => repository.createUser(email, passwordHash),
    });
    process.stdout.write('User provisioned successfully.\n');
  } finally {
    await connection.pool.end();
  }
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main().catch(() => {
    process.stderr.write('User provisioning failed.\n');
    process.exitCode = 1;
  });
}
