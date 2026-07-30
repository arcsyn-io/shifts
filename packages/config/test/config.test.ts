import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/index.js';

const valid = {
  DATABASE_URL: 'postgresql://application:password@localhost:5432/db',
  DATABASE_MIGRATION_URL: 'postgresql://migration:password@localhost:5432/db',
  WEB_URL: 'http://localhost:5173',
  API_URL: 'http://localhost:3000',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_REGION: 'us-east-1',
  S3_BUCKET: 'bucket',
  S3_ACCESS_KEY: 'key',
  S3_SECRET_KEY: 'secret',
};

describe('loadConfig', () => {
  it('parses a valid environment', () => expect(loadConfig(valid).API_PORT).toBe(3000));
  it('fails when a required value is missing', () =>
    expect(() => loadConfig({})).toThrow('Invalid environment configuration'));
});
