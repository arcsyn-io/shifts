import { describe, expect, it } from 'vitest';
import {
  provisionUserWithDependencies,
  readPipedPassword,
  validateProvisionInput,
} from '../scripts/provision-user.js';
import { vi } from 'vitest';

describe('internal user provisioning input', () => {
  it('normalizes email and accepts password only as a separate value', () => {
    expect(validateProvisionInput('  USER@Example.COM ', 'a-strong-password')).toEqual({
      email: 'user@example.com',
      password: 'a-strong-password',
    });
  });

  it('rejects weak provisioning passwords', () => {
    expect(() => validateProvisionInput('user@example.com', 'short')).toThrow(
      'Password must contain at least 12 characters',
    );
  });

  it('reads one password line from piped stdin', async () => {
    async function* input() {
      yield Buffer.from('a-strong-password\n');
    }
    await expect(readPipedPassword(input())).resolves.toBe('a-strong-password');
  });

  it('rejects multiline piped input', async () => {
    async function* input() {
      yield Buffer.from('first-password\nsecond-password\n');
    }
    await expect(readPipedPassword(input())).rejects.toThrow('Password must be a single line');
  });

  it('hashes before persistence without requiring the runtime application config', async () => {
    const hashPassword = vi.fn().mockResolvedValue('argon2-hash');
    const createUser = vi.fn().mockResolvedValue({ id: 'user-id' });

    await provisionUserWithDependencies(
      { email: 'user@example.com', password: 'a-strong-password' },
      { hashPassword, createUser },
    );

    expect(hashPassword).toHaveBeenCalledWith('a-strong-password');
    expect(createUser).toHaveBeenCalledWith('user@example.com', 'argon2-hash');
  });
});
