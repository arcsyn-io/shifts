import { z } from 'zod';

const booleanFromEnv = z.enum(['true', 'false']).transform((value) => value === 'true');

const mcpConfigKeys = [
  'SUPABASE_URL',
  'SUPABASE_ISSUER',
  'SUPABASE_JWKS_URL',
  'SUPABASE_AUDIENCE',
  'SUPABASE_PUBLISHABLE_KEY',
  'MCP_RESOURCE_URI',
] as const;

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string().url(),
    PORT: z.coerce.number().int().positive().optional(),
    API_PORT: z.coerce.number().int().positive().default(3000),
    WEB_URL: z.string().url(),
    API_URL: z.string().url(),
    MCP_ENABLED: booleanFromEnv.default('false'),
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_ISSUER: z.string().url().optional(),
    SUPABASE_JWKS_URL: z.string().url().optional(),
    SUPABASE_AUDIENCE: z.string().trim().min(1).optional(),
    SUPABASE_PUBLISHABLE_KEY: z.string().trim().min(1).optional(),
    MCP_RESOURCE_URI: z.string().url().optional(),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  })
  .superRefine((config, context) => {
    if (!config.MCP_ENABLED) return;

    for (const key of mcpConfigKeys) {
      if (config[key] === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is required when MCP_ENABLED=true`,
        });
      }
    }
  });

export type AppConfig = z.infer<typeof envSchema>;

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
