import { describe, expect, it, vi } from 'vitest';
import { OrganizationsService } from '../src/modules/organizations/application/organizations.service.js';
import { OrganizationsError } from '../src/modules/organizations/organizations.error.js';
import type {
  OrganizationsRepository,
  OrganizationsUnitOfWork,
} from '../src/modules/organizations/repository/organizations.repository.js';

const principal = {
  id: '6aa5bbc6-4888-4b72-a2a7-37ca3bdb786f',
  email: 'owner@example.com',
};
const targetId = 'a166a3c2-401b-47a4-aeb4-e807b2dffe41';
const organization = {
  id: '14d7152f-3c12-4a21-b446-5dc897159eb5',
  name: 'ArcSyn',
  slug: 'arcsyn-shift',
  role: 'owner' as const,
};
const joinedAt = new Date('2026-08-01T00:00:00.000Z');

function createUnitOfWork(
  overrides: Partial<Record<keyof OrganizationsUnitOfWork, ReturnType<typeof vi.fn>>> = {},
): OrganizationsUnitOfWork {
  return {
    setOrganizationContext: vi.fn(),
    lockOrganization: vi.fn(),
    listOrganizations: vi.fn().mockResolvedValue([]),
    findOrganizationBySlug: vi.fn().mockResolvedValue(organization),
    findOrganizationById: vi.fn().mockResolvedValue(organization),
    createOrganization: vi.fn().mockResolvedValue(organization),
    listMembers: vi.fn().mockResolvedValue([]),
    findMember: vi.fn().mockResolvedValue({
      userId: targetId,
      email: 'member@example.com',
      role: 'member',
      joinedAt,
    }),
    updateMemberRole: vi.fn(),
    revokeMember: vi.fn().mockResolvedValue(true),
    cancelPendingInvitations: vi.fn(),
    resolveInvitedUser: vi.fn().mockResolvedValue(targetId),
    createInvitation: vi.fn(),
    listPendingInvitations: vi.fn().mockResolvedValue([]),
    findInvitationForRecipient: vi.fn(),
    activateInvitedMembership: vi.fn(),
    acceptInvitation: vi.fn().mockResolvedValue(true),
    hasActiveMembership: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as OrganizationsUnitOfWork;
}

function createService(
  unitOfWork: OrganizationsUnitOfWork,
  now = new Date('2026-08-08T12:00:00Z'),
) {
  const repository: OrganizationsRepository = {
    withPrincipal: vi.fn(async (_principal, operation) => operation(unitOfWork)),
  };
  return new OrganizationsService(
    repository,
    () => organization.id,
    () => new Date(now),
  );
}

describe('OrganizationsService', () => {
  it('creates an organization and first owner in one principal transaction', async () => {
    const unitOfWork = createUnitOfWork();
    const service = createService(unitOfWork);

    await expect(
      service.create({ principal, name: organization.name, slug: organization.slug }),
    ).resolves.toEqual(organization);
    expect(unitOfWork.setOrganizationContext).toHaveBeenCalledWith(organization.id);
    expect(unitOfWork.createOrganization).toHaveBeenCalledWith({
      id: organization.id,
      principalId: principal.id,
      name: organization.name,
      slug: organization.slug,
    });
  });

  it('locks and re-reads authorization before changing a role', async () => {
    const updated = {
      userId: targetId,
      email: 'member@example.com',
      role: 'admin' as const,
      joinedAt,
    };
    const unitOfWork = createUnitOfWork({
      updateMemberRole: vi.fn().mockResolvedValue(updated),
    });
    const service = createService(unitOfWork);

    await expect(
      service.updateMember({ principal, slug: organization.slug, userId: targetId, role: 'admin' }),
    ).resolves.toEqual({ ...updated, joinedAt: joinedAt.toISOString() });
    expect(unitOfWork.findOrganizationBySlug).toHaveBeenCalledTimes(2);
    expect(unitOfWork.lockOrganization).toHaveBeenCalledWith(organization.id);
  });

  it('denies role changes by an admin before persistence', async () => {
    const unitOfWork = createUnitOfWork({
      findOrganizationBySlug: vi.fn().mockResolvedValue({ ...organization, role: 'admin' }),
    });
    const service = createService(unitOfWork);

    await expect(
      service.updateMember({ principal, slug: organization.slug, userId: targetId, role: 'admin' }),
    ).rejects.toEqual(expect.objectContaining<Partial<OrganizationsError>>({ kind: 'forbidden' }));
    expect(unitOfWork.updateMemberRole).not.toHaveBeenCalled();
  });

  it('cancels pending invitations before revoking an eligible member', async () => {
    const unitOfWork = createUnitOfWork();
    const service = createService(unitOfWork);

    await service.revokeMember({ principal, slug: organization.slug, userId: targetId });

    expect(unitOfWork.cancelPendingInvitations).toHaveBeenCalledWith(
      organization.id,
      targetId,
      new Date('2026-08-08T12:00:00Z'),
    );
    expect(vi.mocked(unitOfWork.cancelPendingInvitations).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(unitOfWork.revokeMember).mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
  });

  it('uses a server-authoritative seven-day invitation expiry', async () => {
    const createInvitation = vi.fn().mockImplementation((input) => ({
      id: 'f50500b8-2fd0-4fbd-8d6e-c59d86540cdb',
      organization: input.organization,
      role: input.role,
      expiresAt: input.expiresAt,
    }));
    const unitOfWork = createUnitOfWork({
      createInvitation,
      findMember: vi.fn().mockResolvedValue(undefined),
    });
    const service = createService(unitOfWork);

    await expect(
      service.createInvitation({
        principal,
        slug: organization.slug,
        email: 'member@example.com',
        role: 'member',
      }),
    ).resolves.toMatchObject({ expiresAt: '2026-08-15T12:00:00.000Z' });
    expect(createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        id: organization.id,
        expiresAt: new Date('2026-08-15T12:00:00.000Z'),
      }),
    );
  });

  it('locks, re-reads and consumes a pending invitation once', async () => {
    const invitation = {
      id: 'f50500b8-2fd0-4fbd-8d6e-c59d86540cdb',
      organizationId: organization.id,
      invitedUserId: principal.id,
      invitedBy: targetId,
      role: 'member' as const,
      status: 'pending' as const,
      expiresAt: new Date('2026-08-09T12:00:00Z'),
    };
    const unitOfWork = createUnitOfWork({
      findInvitationForRecipient: vi.fn().mockResolvedValue(invitation),
    });
    const service = createService(unitOfWork);

    await expect(
      service.acceptInvitation({ principal, invitationId: invitation.id }),
    ).resolves.toEqual(organization);
    expect(unitOfWork.findInvitationForRecipient).toHaveBeenCalledTimes(2);
    expect(unitOfWork.lockOrganization).toHaveBeenCalledWith(organization.id);
    expect(unitOfWork.activateInvitedMembership).toHaveBeenCalledWith(invitation);
    expect(unitOfWork.acceptInvitation).toHaveBeenCalledTimes(1);
  });

  it('returns an accepted active invitation idempotently without reactivation', async () => {
    const invitation = {
      id: 'f50500b8-2fd0-4fbd-8d6e-c59d86540cdb',
      organizationId: organization.id,
      invitedUserId: principal.id,
      invitedBy: targetId,
      role: 'member' as const,
      status: 'accepted' as const,
      expiresAt: new Date('2026-08-09T12:00:00Z'),
    };
    const unitOfWork = createUnitOfWork({
      findInvitationForRecipient: vi.fn().mockResolvedValue(invitation),
    });
    const service = createService(unitOfWork);

    await expect(
      service.acceptInvitation({ principal, invitationId: invitation.id }),
    ).resolves.toEqual(organization);
    expect(unitOfWork.activateInvitedMembership).not.toHaveBeenCalled();
    expect(unitOfWork.acceptInvitation).not.toHaveBeenCalled();
  });

  it('rejects an expired invitation without acquiring organization context or lock', async () => {
    const invitation = {
      id: 'f50500b8-2fd0-4fbd-8d6e-c59d86540cdb',
      organizationId: organization.id,
      invitedUserId: principal.id,
      invitedBy: targetId,
      role: 'member' as const,
      status: 'pending' as const,
      expiresAt: new Date('2026-08-08T12:00:00Z'),
    };
    const unitOfWork = createUnitOfWork({
      findInvitationForRecipient: vi.fn().mockResolvedValue(invitation),
    });
    const service = createService(unitOfWork);

    await expect(
      service.acceptInvitation({ principal, invitationId: invitation.id }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<OrganizationsError>>({ kind: 'invitation_invalid' }),
    );
    expect(unitOfWork.setOrganizationContext).not.toHaveBeenCalled();
    expect(unitOfWork.lockOrganization).not.toHaveBeenCalled();
  });
});
