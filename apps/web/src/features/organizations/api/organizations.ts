import {
  createOrganizationInvitationRequestSchema,
  createOrganizationRequestSchema,
  createOrganizationResponseSchema,
  organizationErrorResponseSchema,
  organizationInvitationSchema,
  organizationInvitationsResponseSchema,
  organizationMemberSchema,
  organizationMembersResponseSchema,
  organizationSchema,
  organizationsResponseSchema,
  updateOrganizationMemberRequestSchema,
  type CreateOrganizationInvitationRequest,
  type CreateOrganizationRequest,
  type Organization,
  type OrganizationErrorResponse,
  type OrganizationInvitation,
  type OrganizationInvitationsResponse,
  type OrganizationMember,
  type OrganizationMembersResponse,
  type OrganizationsResponse,
  type UpdateOrganizationMemberRequest,
} from '@arcsyn-shift/contracts';

const ORGANIZATIONS_ENDPOINT = '/api/organizations';
const INVITATIONS_ENDPOINT = '/api/organization-invitations';

export class OrganizationRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: OrganizationErrorResponse['code'] | undefined,
    message: string,
  ) {
    super(message);
    this.name = 'OrganizationRequestError';
  }
}

async function readError(response: Response): Promise<OrganizationErrorResponse | undefined> {
  try {
    const body: unknown = await response.json();
    const parsed = organizationErrorResponseSchema.safeParse(body);
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

async function throwOrganizationError(response: Response): Promise<never> {
  const error = await readError(response);
  throw new OrganizationRequestError(
    response.status,
    error?.code,
    error?.message ?? 'Organization request unavailable',
  );
}

function organizationEndpoint(slug: string): string {
  return `${ORGANIZATIONS_ENDPOINT}/${encodeURIComponent(slug)}`;
}

async function request(endpoint: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(endpoint, {
    credentials: 'same-origin',
    ...init,
  });

  if (!response.ok) return throwOrganizationError(response);
  return response;
}

export async function fetchOrganizations(signal?: AbortSignal): Promise<OrganizationsResponse> {
  const response = await request(ORGANIZATIONS_ENDPOINT, signal ? { signal } : undefined);
  const body: unknown = await response.json();
  return organizationsResponseSchema.parse(body);
}

export async function createOrganization(input: CreateOrganizationRequest): Promise<Organization> {
  const body = createOrganizationRequestSchema.parse(input);
  const response = await request(ORGANIZATIONS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const responseBody: unknown = await response.json();
  return createOrganizationResponseSchema.parse(responseBody);
}

export async function fetchOrganization(slug: string, signal?: AbortSignal): Promise<Organization> {
  const response = await request(organizationEndpoint(slug), signal ? { signal } : undefined);
  const body: unknown = await response.json();
  return organizationSchema.parse(body);
}

export async function fetchOrganizationMembers(
  slug: string,
  signal?: AbortSignal,
): Promise<OrganizationMembersResponse> {
  const response = await request(
    `${organizationEndpoint(slug)}/members`,
    signal ? { signal } : undefined,
  );
  const body: unknown = await response.json();
  return organizationMembersResponseSchema.parse(body);
}

export async function updateOrganizationMember(
  slug: string,
  userId: string,
  input: UpdateOrganizationMemberRequest,
): Promise<OrganizationMember> {
  const body = updateOrganizationMemberRequestSchema.parse(input);
  const response = await request(
    `${organizationEndpoint(slug)}/members/${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  const responseBody: unknown = await response.json();
  return organizationMemberSchema.parse(responseBody);
}

export async function revokeOrganizationMember(slug: string, userId: string): Promise<void> {
  await request(`${organizationEndpoint(slug)}/members/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
}

export async function createOrganizationInvitation(
  slug: string,
  input: CreateOrganizationInvitationRequest,
): Promise<OrganizationInvitation> {
  const body = createOrganizationInvitationRequestSchema.parse(input);
  const response = await request(`${organizationEndpoint(slug)}/invitations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const responseBody: unknown = await response.json();
  return organizationInvitationSchema.parse(responseBody);
}

export async function fetchOrganizationInvitations(
  signal?: AbortSignal,
): Promise<OrganizationInvitationsResponse> {
  const response = await request(INVITATIONS_ENDPOINT, signal ? { signal } : undefined);
  const body: unknown = await response.json();
  return organizationInvitationsResponseSchema.parse(body);
}

export async function acceptOrganizationInvitation(invitationId: string): Promise<Organization> {
  const response = await request(
    `${INVITATIONS_ENDPOINT}/${encodeURIComponent(invitationId)}/accept`,
    { method: 'POST' },
  );
  const responseBody: unknown = await response.json();
  return organizationSchema.parse(responseBody);
}
