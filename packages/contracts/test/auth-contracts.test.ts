import { describe, expect, it } from 'vitest';
import { authSessionResponseSchema, loginRequestSchema } from '../src/index.js';

describe('auth contracts', () => {
  it('normalizes a valid login request and strips no unexpected fields', () => {
    expect(
      loginRequestSchema.parse({ email: '  USER@Example.COM ', password: 'password' }),
    ).toEqual({ email: 'user@example.com', password: 'password' });
    expect(() =>
      loginRequestSchema.parse({
        email: 'user@example.com',
        password: 'password',
        accessToken: 'unsupported',
      }),
    ).toThrow();
  });

  it('accepts only the public authenticated-session response', () => {
    expect(
      authSessionResponseSchema.parse({
        authenticated: true,
        user: { id: '6aa5bbc6-4888-4b72-a2a7-37ca3bdb786f', email: 'user@example.com' },
        csrfToken: 'csrf-token-with-at-least-thirty-two-characters',
      }),
    ).toEqual({
      authenticated: true,
      user: { id: '6aa5bbc6-4888-4b72-a2a7-37ca3bdb786f', email: 'user@example.com' },
      csrfToken: 'csrf-token-with-at-least-thirty-two-characters',
    });
    expect(() =>
      authSessionResponseSchema.parse({
        authenticated: true,
        user: { id: '6aa5bbc6-4888-4b72-a2a7-37ca3bdb786f', email: 'user@example.com' },
        csrfToken: 'csrf-token-with-at-least-thirty-two-characters',
        accessToken: 'must-never-be-returned',
      }),
    ).toThrow();
  });
});
