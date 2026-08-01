import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/index.js';

const valid = {
  DATABASE_URL: 'postgresql://application:password@localhost:5432/db',
  WEB_URL: 'http://localhost:5173',
  API_URL: 'http://localhost:3000',
};

describe('loadConfig', () => {
  it('parses a valid environment', () => expect(loadConfig(valid).API_PORT).toBe(3000));

  it('keeps the public MCP endpoint disabled by default', () => {
    expect(loadConfig(valid).MCP_ENABLED).toBe(false);
  });

  it('parses the platform port when provided', () => {
    expect(loadConfig({ ...valid, PORT: '4321' }).PORT).toBe(4321);
  });
  it('fails when a required value is missing', () =>
    expect(() => loadConfig({})).toThrow('Invalid environment configuration'));
});
