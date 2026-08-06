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
    email: z.string().trim().email().max(320),
    password: z.string().min(1).max(1024),
  })
  .strict();
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const authSessionResponseSchema = z
  .object({
    principal: z
      .object({
        id: z.string().uuid(),
        email: z.string().email(),
      })
      .strict(),
  })
  .strict();
export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>;

export const authErrorResponseSchema = z
  .object({
    code: z.enum([
      'AUTH_INVALID_REQUEST',
      'AUTH_INVALID_CREDENTIALS',
      'AUTH_UNAUTHORIZED',
      'AUTH_FORBIDDEN',
      'AUTH_UNAVAILABLE',
    ]),
    message: z.string().min(1),
  })
  .strict();
export type AuthErrorResponse = z.infer<typeof authErrorResponseSchema>;
