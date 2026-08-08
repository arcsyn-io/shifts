import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  OrganizationRequestError,
  acceptOrganizationInvitation,
  createOrganization,
  createOrganizationInvitation,
  fetchOrganizationMembers,
  fetchOrganizations,
  revokeOrganizationMember,
  updateOrganizationMember,
} from '@/features/organizations/api/organizations';

const organization = {
  id: '9d1665ae-2928-456f-92d8-d5f652f4f1f3',
  name: 'ArcSyn Operations',
  slug: 'arcsyn-operations',
  role: 'owner',
} as const;

const member = {
  userId: '2362bbd1-a01d-4db0-b10b-7abdd1323033',
  email: 'member@example.test',
  role: 'member',
  joinedAt: '2026-08-08T18:00:00.000Z',
} as const;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('organizations API', () => {
  it('lists and runtime-validates organizations with same-origin credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ organizations: [organization] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchOrganizations()).resolves.toEqual({ organizations: [organization] });
    expect(fetchMock).toHaveBeenCalledWith('/api/organizations', {
      credentials: 'same-origin',
    });
  });

  it('creates an organization with the shared request contract', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(organization), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await createOrganization({ name: organization.name, slug: organization.slug });

    expect(fetchMock).toHaveBeenCalledWith('/api/organizations', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: organization.name, slug: organization.slug }),
    });
  });

  it('validates member responses and encodes path segments', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ members: [member] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...member, role: 'admin' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchOrganizationMembers(organization.slug)).resolves.toEqual({
      members: [member],
    });
    await expect(
      updateOrganizationMember(organization.slug, member.userId, { role: 'admin' }),
    ).resolves.toEqual({ ...member, role: 'admin' });
    await expect(
      revokeOrganizationMember(organization.slug, member.userId),
    ).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/organizations/${organization.slug}/members/${member.userId}`,
      expect.objectContaining({ method: 'PATCH', credentials: 'same-origin' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      `/api/organizations/${organization.slug}/members/${member.userId}`,
      { method: 'DELETE', credentials: 'same-origin' },
    );
  });

  it('creates and accepts invitations through their dedicated endpoints', async () => {
    const invitation = {
      id: 'b6dcf490-9c49-46d8-9bad-f3dfd227b7fd',
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      },
      role: 'member',
      expiresAt: '2026-08-15T18:00:00.000Z',
    } as const;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(invitation), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(organization), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await createOrganizationInvitation(organization.slug, {
      email: member.email,
      role: 'member',
    });
    await acceptOrganizationInvitation(invitation.id);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `/api/organizations/${organization.slug}/invitations`,
      expect.objectContaining({ method: 'POST', credentials: 'same-origin' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/organization-invitations/${invitation.id}/accept`,
      { method: 'POST', credentials: 'same-origin' },
    );
  });

  it('preserves structured organization errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 'ORGANIZATION_FORBIDDEN',
            message: 'Organization unavailable',
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    await expect(fetchOrganizations()).rejects.toEqual(
      expect.objectContaining<OrganizationRequestError>({
        name: 'OrganizationRequestError',
        status: 403,
        code: 'ORGANIZATION_FORBIDDEN',
        message: 'Organization unavailable',
      }),
    );
  });

  it('rejects successful responses outside the shared contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ organizations: [{ ...organization, role: 'super-admin' }] }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      ),
    );

    await expect(fetchOrganizations()).rejects.toThrow();
  });
});
