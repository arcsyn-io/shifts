import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/index.js';

const valid = {
  DATABASE_URL: 'postgresql://application:password@localhost:5432/db',
  WEB_URL: 'http://localhost:5173',
  API_URL: 'http://localhost:3000',
};

const validMcp = {
  MCP_ENABLED: 'true',
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_ISSUER: 'http://127.0.0.1:54321/auth/v1',
  SUPABASE_JWKS_URL: 'http://127.0.0.1:54321/auth/v1/.well-known/jwks.json',
  SUPABASE_AUDIENCE: 'authenticated',
  SUPABASE_PUBLISHABLE_KEY: 'local-publishable-key',
  MCP_RESOURCE_URI: 'http://localhost:3000/mcp',
};

const validProduction = {
  ...valid,
  NODE_ENV: 'production',
  WEB_URL: 'https://app.example.com',
  API_URL: 'https://api.example.com',
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
};

describe('loadConfig', () => {
  it('parses a valid environment', () => expect(loadConfig(valid).API_PORT).toBe(3000));

  it('keeps the public MCP endpoint disabled by default', () => {
    const config = loadConfig(valid);

    expect(config.MCP_ENABLED).toBe(false);
    expect(config).not.toHaveProperty('SUPABASE_URL');
    expect(config).not.toHaveProperty('SUPABASE_ISSUER');
    expect(config).not.toHaveProperty('SUPABASE_JWKS_URL');
    expect(config).not.toHaveProperty('SUPABASE_AUDIENCE');
    expect(config).not.toHaveProperty('SUPABASE_PUBLISHABLE_KEY');
    expect(config).not.toHaveProperty('MCP_RESOURCE_URI');
  });

  it('parses the Supabase and canonical MCP URLs when MCP is enabled', () => {
    expect(loadConfig({ ...valid, ...validMcp })).toMatchObject({
      ...validMcp,
      MCP_ENABLED: true,
    });
  });

  it.each([
    'SUPABASE_URL',
    'SUPABASE_ISSUER',
    'SUPABASE_JWKS_URL',
    'SUPABASE_AUDIENCE',
    'SUPABASE_PUBLISHABLE_KEY',
    'MCP_RESOURCE_URI',
  ] as const)('requires %s when MCP is enabled', (key) => {
    const environment = { ...valid, ...validMcp };
    delete environment[key];

    expect(() => loadConfig(environment)).toThrow(
      `${key}: ${key} is required when MCP_ENABLED=true`,
    );
  });

  it.each(['SUPABASE_URL', 'SUPABASE_ISSUER', 'SUPABASE_JWKS_URL', 'MCP_RESOURCE_URI'] as const)(
    'validates %s when MCP is disabled and the value is present',
    (key) => {
      expect(() => loadConfig({ ...valid, [key]: 'not-a-url' })).toThrow(`${key}: Invalid url`);
    },
  );

  it.each(['SUPABASE_AUDIENCE', 'SUPABASE_PUBLISHABLE_KEY'] as const)(
    'rejects an empty %s when present',
    (key) => {
      expect(() => loadConfig({ ...valid, [key]: ' ' })).toThrow(`${key}:`);
    },
  );

  it('parses the platform port when provided', () => {
    expect(loadConfig({ ...valid, PORT: '4321' }).PORT).toBe(4321);
  });

  it('parses a production environment with exact HTTPS origins and Supabase credentials', () => {
    expect(loadConfig(validProduction)).toMatchObject({
      ...validProduction,
      MCP_ENABLED: false,
    });
  });

  it.each(['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY'] as const)(
    'requires %s in production',
    (key) => {
      const environment = { ...validProduction };
      delete environment[key];

      expect(() => loadConfig(environment)).toThrow(`${key}: ${key} is required in production`);
    },
  );

  it.each(['WEB_URL', 'API_URL', 'SUPABASE_URL'] as const)(
    'requires %s to be an exact HTTPS origin in production',
    (key) => {
      for (const invalidOrigin of [
        'http://example.com',
        'https://user@example.com',
        'https://example.com/path',
        'https://example.com?query=value',
        'https://example.com#fragment',
        'https://example.com/',
      ]) {
        expect(() => loadConfig({ ...validProduction, [key]: invalidOrigin })).toThrow(
          `${key}: ${key} must be an exact HTTPS origin in production`,
        );
      }
    },
  );

  it('requires the production Supabase key prefix', () => {
    expect(() =>
      loadConfig({ ...validProduction, SUPABASE_PUBLISHABLE_KEY: 'local-publishable-key' }),
    ).toThrow(
      'SUPABASE_PUBLISHABLE_KEY: SUPABASE_PUBLISHABLE_KEY must start with sb_publishable_ in production',
    );
  });

  it('keeps MCP disabled in production', () => {
    expect(() =>
      loadConfig({
        ...validProduction,
        ...validMcp,
        SUPABASE_URL: validProduction.SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY: validProduction.SUPABASE_PUBLISHABLE_KEY,
      }),
    ).toThrow('MCP_ENABLED: MCP_ENABLED must be false in production');
  });

  it('fails when a required value is missing', () =>
    expect(() => loadConfig({})).toThrow('Invalid environment configuration'));
});
