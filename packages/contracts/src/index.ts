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

export const organizationRoleSchema = z.enum(['owner', 'admin', 'member']);
export type OrganizationRole = z.infer<typeof organizationRoleSchema>;

export const organizationSlugSchema = z
  .string()
  .trim()
  .min(3)
  .max(39)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const organizationSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).max(80),
    slug: organizationSlugSchema,
    role: organizationRoleSchema,
  })
  .strict();
export type Organization = z.infer<typeof organizationSchema>;

export const organizationsResponseSchema = z
  .object({ organizations: z.array(organizationSchema) })
  .strict();
export type OrganizationsResponse = z.infer<typeof organizationsResponseSchema>;

export const createOrganizationRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    slug: organizationSlugSchema,
  })
  .strict();
export type CreateOrganizationRequest = z.infer<typeof createOrganizationRequestSchema>;

export const createOrganizationResponseSchema = organizationSchema;
export type CreateOrganizationResponse = Organization;

export const organizationMemberSchema = z
  .object({
    userId: z.string().uuid(),
    email: z.string().email(),
    role: organizationRoleSchema,
    joinedAt: z.string().datetime(),
  })
  .strict();
export type OrganizationMember = z.infer<typeof organizationMemberSchema>;

export const organizationMembersResponseSchema = z
  .object({ members: z.array(organizationMemberSchema) })
  .strict();
export type OrganizationMembersResponse = z.infer<typeof organizationMembersResponseSchema>;

export const createOrganizationInvitationRequestSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(320),
    role: organizationRoleSchema,
  })
  .strict();
export type CreateOrganizationInvitationRequest = z.infer<
  typeof createOrganizationInvitationRequestSchema
>;

export const organizationInvitationSchema = z
  .object({
    id: z.string().uuid(),
    organization: organizationSchema.pick({ id: true, name: true, slug: true }),
    role: organizationRoleSchema,
    expiresAt: z.string().datetime(),
  })
  .strict();
export type OrganizationInvitation = z.infer<typeof organizationInvitationSchema>;

export const organizationInvitationsResponseSchema = z
  .object({ invitations: z.array(organizationInvitationSchema) })
  .strict();
export type OrganizationInvitationsResponse = z.infer<typeof organizationInvitationsResponseSchema>;

export const updateOrganizationMemberRequestSchema = z
  .object({ role: organizationRoleSchema })
  .strict();
export type UpdateOrganizationMemberRequest = z.infer<typeof updateOrganizationMemberRequestSchema>;

export const organizationErrorResponseSchema = z
  .object({
    code: z.enum([
      'ORGANIZATION_INVALID_REQUEST',
      'ORGANIZATION_NOT_FOUND',
      'ORGANIZATION_FORBIDDEN',
      'ORGANIZATION_CONFLICT',
      'ORGANIZATION_INVITATION_INVALID',
      'ORGANIZATION_USER_NOT_FOUND',
      'ORGANIZATION_UNAVAILABLE',
    ]),
    message: z.string().min(1),
  })
  .strict();
export type OrganizationErrorResponse = z.infer<typeof organizationErrorResponseSchema>;
