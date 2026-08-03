import { z } from 'zod';

const booleanFromEnv = z.enum(['true', 'false']).transform((value) => value === 'true');

const secretFromEnv = z.string().superRefine((value, context) => {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'must be canonical base64url' });
    return;
  }
  const decoded = Buffer.from(value, 'base64url');
  if (decoded.toString('base64url') !== value) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'must be canonical base64url' });
  }
  if (decoded.byteLength < 32) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'must contain at least 32 bytes' });
  }
  if (new Set(decoded).size < 8) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'must not use a low-entropy pattern',
    });
  }
});

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string().url(),
    PORT: z.coerce.number().int().positive().optional(),
    API_PORT: z.coerce.number().int().positive().default(3000),
    WEB_URL: z.string().url(),
    API_URL: z.string().url(),
    MCP_ENABLED: booleanFromEnv.default('false'),
    AUTH_JWT_SECRET: secretFromEnv,
    AUTH_RATE_LIMIT_SECRET: secretFromEnv,
    AUTH_JWT_ISSUER: z.string().min(1).default('arcsyn-shift-api'),
    AUTH_JWT_AUDIENCE: z.string().min(1).default('arcsyn-shift-web'),
    AUTH_LOGIN_ACCOUNT_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(100).default(5),
    AUTH_LOGIN_ORIGIN_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(1000).default(30),
    AUTH_REFRESH_ORIGIN_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(1000).default(60),
    AUTH_LOGIN_WINDOW_SECONDS: z.coerce.number().int().min(60).max(86_400).default(900),
    AUTH_LOGIN_BLOCK_SECONDS: z.coerce.number().int().min(60).max(86_400).default(900),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  })
  .superRefine((config, context) => {
    if (config.AUTH_JWT_SECRET === config.AUTH_RATE_LIMIT_SECRET) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AUTH_RATE_LIMIT_SECRET'],
        message: 'must be independent from AUTH_JWT_SECRET',
      });
    }
  })
  .transform((config) => ({
    ...config,
    MCP_ENABLED: config.NODE_ENV === 'development' && config.MCP_ENABLED,
  }));

export type AppConfig = z.infer<typeof envSchema>;

export const provisioningEnvSchema = z.object({
  DATABASE_PROVISIONING_URL: z.string().url(),
});

export type ProvisioningConfig = z.infer<typeof provisioningEnvSchema>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return result.data;
}

export function loadProvisioningConfig(
  source: NodeJS.ProcessEnv = process.env,
): ProvisioningConfig {
  const result = provisioningEnvSchema.safeParse(source);
  if (!result.success) throw new Error('Invalid provisioning configuration');
  return result.data;
}
