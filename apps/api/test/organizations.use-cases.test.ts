import type { Database, DatabaseTransaction } from '@arcsyn-shift/database';
import { describe, expect, it, vi } from 'vitest';
import {
  ApplicationContext,
  ApplicationContextAuthenticator,
  ApplicationTransactionContext,
} from '../src/infrastructure/context/application-context.js';
import { TransactionManager } from '../src/infrastructure/database/transaction-manager.js';
import { OrganizationsService } from '../src/modules/organizations/application/organizations.service.js';
import { OrganizationsError } from '../src/modules/organizations/organizations.error.js';
import {
  OrganizationRepositoryError,
  type OrganizationsRepository,
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

function createRepository(
  overrides: Partial<Record<keyof OrganizationsRepository, ReturnType<typeof vi.fn>>> = {},
): OrganizationsRepository {
  return {
    lockOrganization: vi.fn(),
    listOrganizations: vi.fn().mockResolvedValue([]),
    findOrganizationIdBySlug: vi.fn().mockResolvedValue(organization.id),
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
  } as OrganizationsRepository;
}

function createHarness(
  repository: OrganizationsRepository,
  now = new Date('2026-08-08T12:00:00Z'),
) {
  const applicationContext = new ApplicationContext();
  const authenticator = new ApplicationContextAuthenticator(applicationContext);
  const transactionContext = new ApplicationTransactionContext(applicationContext);
  const transaction = {
    execute: vi.fn().mockResolvedValue({ rows: [] }),
  } as unknown as DatabaseTransaction;
  const transactionManager = new TransactionManager(
    {} as Database,
    applicationContext,
    transactionContext,
  );
  const service = new OrganizationsService(
    repository,
    applicationContext,
    transactionManager,
    () => organization.id,
    () => new Date(now),
  );

  return {
    transaction,
    run<T>(operation: (service: OrganizationsService) => Promise<T>): Promise<T> {
      return applicationContext.run(async () => {
        authenticator.setPrincipal(principal);
        transactionContext.setTransaction(transaction);
        try {
          return await operation(service);
        } finally {
          transactionContext.clearTransaction(transaction);
        }
      });
    },
  };
}

describe('OrganizationsService', () => {
  it('creates an organization and first owner in one selected tenant transaction', async () => {
    const repository = createRepository();
    const harness = createHarness(repository);

    await expect(
      harness.run((service) =>
        service.create({ name: organization.name, slug: organization.slug }),
      ),
    ).resolves.toEqual(organization);
    expect(harness.transaction.execute).toHaveBeenCalledOnce();
    expect(repository.createOrganization).toHaveBeenCalledWith({
      id: organization.id,
      principalId: principal.id,
      name: organization.name,
      slug: organization.slug,
    });
  });

  it('selects the tenant once, locks and re-reads authorization before changing a role', async () => {
    const updated = {
      userId: targetId,
      email: 'member@example.com',
      role: 'admin' as const,
      joinedAt,
    };
    const repository = createRepository({
      updateMemberRole: vi.fn().mockResolvedValue(updated),
    });
    const harness = createHarness(repository);

    await expect(
      harness.run((service) =>
        service.updateMember({ slug: organization.slug, userId: targetId, role: 'admin' }),
      ),
    ).resolves.toEqual({ ...updated, joinedAt: joinedAt.toISOString() });
    expect(repository.findOrganizationIdBySlug).toHaveBeenCalledOnce();
    expect(repository.findOrganizationById).toHaveBeenCalledTimes(2);
    expect(repository.lockOrganization).toHaveBeenCalledWith(organization.id);
    expect(harness.transaction.execute).toHaveBeenCalledOnce();
  });

  it('denies role changes by an admin before persistence', async () => {
    const repository = createRepository({
      findOrganizationById: vi.fn().mockResolvedValue({ ...organization, role: 'admin' }),
    });
    const harness = createHarness(repository);

    await expect(
      harness.run((service) =>
        service.updateMember({ slug: organization.slug, userId: targetId, role: 'admin' }),
      ),
    ).rejects.toEqual(expect.objectContaining<Partial<OrganizationsError>>({ kind: 'forbidden' }));
    expect(repository.updateMemberRole).not.toHaveBeenCalled();
  });

  it('cancels pending invitations before revoking an eligible member', async () => {
    const repository = createRepository();
    const harness = createHarness(repository);

    await harness.run((service) =>
      service.revokeMember({ slug: organization.slug, userId: targetId }),
    );

    expect(repository.cancelPendingInvitations).toHaveBeenCalledWith(
      organization.id,
      targetId,
      new Date('2026-08-08T12:00:00Z'),
    );
    expect(vi.mocked(repository.cancelPendingInvitations).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(repository.revokeMember).mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
  });

  it('uses a server-authoritative seven-day invitation expiry', async () => {
    const createInvitation = vi.fn().mockImplementation((input) => ({
      id: 'f50500b8-2fd0-4fbd-8d6e-c59d86540cdb',
      organization: input.organization,
      role: input.role,
      expiresAt: input.expiresAt,
    }));
    const repository = createRepository({
      createInvitation,
      findMember: vi.fn().mockResolvedValue(undefined),
    });
    const harness = createHarness(repository);

    await expect(
      harness.run((service) =>
        service.createInvitation({
          slug: organization.slug,
          email: 'member@example.com',
          role: 'member',
        }),
      ),
    ).resolves.toMatchObject({ expiresAt: '2026-08-15T12:00:00.000Z' });
    expect(createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        id: organization.id,
        invitedBy: principal.id,
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
    const repository = createRepository({
      findInvitationForRecipient: vi.fn().mockResolvedValue(invitation),
    });
    const harness = createHarness(repository);

    await expect(
      harness.run((service) => service.acceptInvitation({ invitationId: invitation.id })),
    ).resolves.toEqual(organization);
    expect(repository.findInvitationForRecipient).toHaveBeenCalledTimes(2);
    expect(repository.lockOrganization).toHaveBeenCalledWith(organization.id);
    expect(repository.activateInvitedMembership).toHaveBeenCalledWith(invitation);
    expect(repository.acceptInvitation).toHaveBeenCalledTimes(1);
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
    const repository = createRepository({
      findInvitationForRecipient: vi.fn().mockResolvedValue(invitation),
    });
    const harness = createHarness(repository);

    await expect(
      harness.run((service) => service.acceptInvitation({ invitationId: invitation.id })),
    ).resolves.toEqual(organization);
    expect(repository.activateInvitedMembership).not.toHaveBeenCalled();
    expect(repository.acceptInvitation).not.toHaveBeenCalled();
  });

  it('rejects an expired invitation before selecting or locking a tenant', async () => {
    const invitation = {
      id: 'f50500b8-2fd0-4fbd-8d6e-c59d86540cdb',
      organizationId: organization.id,
      invitedUserId: principal.id,
      invitedBy: targetId,
      role: 'member' as const,
      status: 'pending' as const,
      expiresAt: new Date('2026-08-08T12:00:00Z'),
    };
    const repository = createRepository({
      findInvitationForRecipient: vi.fn().mockResolvedValue(invitation),
    });
    const harness = createHarness(repository);

    await expect(
      harness.run((service) => service.acceptInvitation({ invitationId: invitation.id })),
    ).rejects.toEqual(
      expect.objectContaining<Partial<OrganizationsError>>({ kind: 'invitation_invalid' }),
    );
    expect(harness.transaction.execute).not.toHaveBeenCalled();
    expect(repository.lockOrganization).not.toHaveBeenCalled();
  });

  it('translates an expected repository conflict and preserves its cause', async () => {
    const repositoryError = new OrganizationRepositoryError('conflict');
    const repository = createRepository({
      createOrganization: vi.fn().mockRejectedValue(repositoryError),
    });
    const harness = createHarness(repository);

    const failure = harness.run((service) =>
      service.create({ name: organization.name, slug: organization.slug }),
    );

    await expect(failure).rejects.toEqual(
      expect.objectContaining<Partial<OrganizationsError>>({ kind: 'conflict' }),
    );
    await expect(failure).rejects.toHaveProperty('cause', repositoryError);
  });

  it('keeps a technical repository error intact for the presentation boundary', async () => {
    const repositoryError = new OrganizationRepositoryError('unavailable');
    const repository = createRepository({
      createOrganization: vi.fn().mockRejectedValue(repositoryError),
    });
    const harness = createHarness(repository);

    await expect(
      harness.run((service) =>
        service.create({ name: organization.name, slug: organization.slug }),
      ),
    ).rejects.toBe(repositoryError);
  });
});
