import { describe, expect, it } from 'vitest';
import {
  authErrorResponseSchema,
  authSessionResponseSchema,
  loginRequestSchema,
} from '../src/index.js';

describe('auth contracts', () => {
  it('accepts the public login and session shapes', () => {
    expect(loginRequestSchema.parse({ email: 'user@example.com', password: 'secret' })).toEqual({
      email: 'user@example.com',
      password: 'secret',
    });
    expect(
      authSessionResponseSchema.parse({
        principal: {
          id: '6aa5bbc6-4888-4b72-a2a7-37ca3bdb786f',
          email: 'user@example.com',
        },
      }),
    ).toEqual({
      principal: {
        id: '6aa5bbc6-4888-4b72-a2a7-37ca3bdb786f',
        email: 'user@example.com',
      },
    });
  });

  it('rejects token-shaped additions to public responses', () => {
    expect(
      authSessionResponseSchema.safeParse({
        principal: {
          id: '6aa5bbc6-4888-4b72-a2a7-37ca3bdb786f',
          email: 'user@example.com',
        },
        accessToken: 'must-not-cross-the-bff',
      }).success,
    ).toBe(false);
  });

  it('keeps authentication errors bounded to approved public codes', () => {
    expect(
      authErrorResponseSchema.parse({
        code: 'AUTH_UNAUTHORIZED',
        message: 'Sessão inválida ou expirada.',
      }),
    ).toEqual({
      code: 'AUTH_UNAUTHORIZED',
      message: 'Sessão inválida ou expirada.',
    });
    expect(
      authErrorResponseSchema.safeParse({ code: 'SUPABASE_ERROR', message: 'provider details' })
        .success,
    ).toBe(false);
  });
});
