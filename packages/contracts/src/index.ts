import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  database: z.literal('connected'),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const mcpHealthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('arcsyn-shift-mcp'),
});
export type McpHealthResponse = z.infer<typeof mcpHealthResponseSchema>;

export const loginRequestSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    password: z.string().min(1).max(1024),
  })
  .strict();
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const authUserSchema = z
  .object({
    id: z.string().uuid(),
    email: z.string().email(),
  })
  .strict();
export type AuthUser = z.infer<typeof authUserSchema>;

export const authSessionResponseSchema = z
  .object({
    authenticated: z.literal(true),
    user: authUserSchema,
    csrfToken: z.string().min(32),
  })
  .strict();
export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>;
