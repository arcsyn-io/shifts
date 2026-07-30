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
