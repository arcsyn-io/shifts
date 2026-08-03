import { describe, expect, it } from 'vitest';
import { loadConfig, loadProvisioningConfig } from '../src/index.js';

const valid = {
  DATABASE_URL: 'postgresql://application:password@localhost:5432/db',
  WEB_URL: 'http://localhost:5173',
  API_URL: 'http://localhost:3000',
  AUTH_JWT_SECRET: 'lgbPzYSIrOguUZ8nd5yR6wgNd2M8465pNTf7oZ-0aas',
  AUTH_RATE_LIMIT_SECRET: '3b1hfyM51LD-Zz7WGJuzZeTrcJ6EnnLumtv6MFYdh3k',
};

describe('loadConfig', () => {
  it('parses a valid environment', () => expect(loadConfig(valid).API_PORT).toBe(3000));

  it('keeps the public MCP endpoint disabled by default', () => {
    expect(loadConfig(valid).MCP_ENABLED).toBe(false);
  });

  it('forces MCP off outside development', () => {
    expect(loadConfig({ ...valid, NODE_ENV: 'production', MCP_ENABLED: 'true' }).MCP_ENABLED).toBe(
      false,
    );
  });

  it('rejects a short JWT secret', () => {
    expect(() => loadConfig({ ...valid, AUTH_JWT_SECRET: 'too-short' })).toThrow(
      'Invalid environment configuration',
    );
  });

  it('rejects placeholders and a missing independent rate-limit secret', () => {
    expect(() =>
      loadConfig({ ...valid, AUTH_JWT_SECRET: '<required-base64url-32-byte-secret>' }),
    ).toThrow('Invalid environment configuration');
    expect(() => loadConfig({ ...valid, AUTH_RATE_LIMIT_SECRET: undefined })).toThrow(
      'Invalid environment configuration',
    );
  });

  it('rejects low-entropy and reused secrets', () => {
    expect(() =>
      loadConfig({ ...valid, AUTH_JWT_SECRET: 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE' }),
    ).toThrow('Invalid environment configuration');
    expect(() => loadConfig({ ...valid, AUTH_RATE_LIMIT_SECRET: valid.AUTH_JWT_SECRET })).toThrow(
      'Invalid environment configuration',
    );
  });

  it('parses the platform port when provided', () => {
    expect(loadConfig({ ...valid, PORT: '4321' }).PORT).toBe(4321);
  });
  it('fails when a required value is missing', () =>
    expect(() => loadConfig({})).toThrow('Invalid environment configuration'));
});

describe('loadProvisioningConfig', () => {
  it('requires the isolated provisioning connection without affecting runtime config', () => {
    expect(() => loadProvisioningConfig({})).toThrow('Invalid provisioning configuration');
    expect(
      loadProvisioningConfig({
        DATABASE_PROVISIONING_URL: 'postgresql://provisioner:password@localhost:5432/db',
      }),
    ).toEqual({
      DATABASE_PROVISIONING_URL: 'postgresql://provisioner:password@localhost:5432/db',
    });
    expect(loadConfig(valid)).not.toHaveProperty('DATABASE_PROVISIONING_URL');
  });
});
