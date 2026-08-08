import {
  and,
  asc,
  eq,
  gt,
  organizationInvitations,
  organizationMemberships,
  organizations,
  sql,
  userProfiles,
  withPrincipalContext,
  type Database,
  type DatabaseTransaction,
} from '@arcsyn-shift/database';
import type { OrganizationRole } from '@arcsyn-shift/contracts';
import type {
  InvitationStateEntity,
  OrganizationEntity,
  OrganizationInvitationEntity,
  OrganizationMemberEntity,
} from '../domain/entities/organization.entity.js';
import {
  OrganizationRepositoryError,
  type OrganizationsRepository,
  type OrganizationsUnitOfWork,
} from './organizations.repository.js';

const ORGANIZATION_LIST_LIMIT = 100;
const MEMBER_LIST_LIMIT = 500;
const INVITATION_LIST_LIMIT = 100;

export class DrizzleOrganizationsRepository implements OrganizationsRepository {
  constructor(private readonly database: Database) {}

  async withPrincipal<T>(
    principal: { id: string; email: string },
    operation: (unitOfWork: OrganizationsUnitOfWork) => Promise<T>,
  ): Promise<T> {
    try {
      return await withPrincipalContext(this.database, principal.id, async (transaction) => {
        await syncUserProfile(transaction, principal);
        return operation(new DrizzleOrganizationsUnitOfWork(transaction));
      });
    } catch (error) {
      if (error instanceof OrganizationRepositoryError) throw error;
      throw mapDatabaseError(error);
    }
  }
}

class DrizzleOrganizationsUnitOfWork implements OrganizationsUnitOfWork {
  constructor(private readonly transaction: DatabaseTransaction) {}

  async setOrganizationContext(organizationId: string): Promise<void> {
    await this.transaction.execute(
      sql`select set_config('app.current_organization_id', ${organizationId}, true)`,
    );
  }

  async lockOrganization(organizationId: string): Promise<void> {
    await this.transaction.execute(sql`select app_private.lock_organization(${organizationId})`);
  }

  async listOrganizations(): Promise<OrganizationEntity[]> {
    const result = await this.transaction.execute<{
      id: string;
      name: string;
      slug: string;
      role: OrganizationRole;
    }>(sql`select * from app_private.list_current_user_organizations()`);
    return result.rows.slice(0, ORGANIZATION_LIST_LIMIT);
  }

  async findOrganizationBySlug(
    principalId: string,
    slug: string,
  ): Promise<OrganizationEntity | undefined> {
    const rows = await this.transaction
      .select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
      .from(organizations)
      .where(and(eq(organizations.slug, slug), eq(organizations.status, 'active')))
      .limit(1);
    const organization = rows[0];
    if (!organization) return undefined;
    await this.setOrganizationContext(organization.id);
    const role = await this.findActiveRole(organization.id, principalId);
    return role ? { ...organization, role } : undefined;
  }

  async findOrganizationById(
    principalId: string,
    organizationId: string,
  ): Promise<OrganizationEntity | undefined> {
    const rows = await this.transaction
      .select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
      .from(organizations)
      .where(and(eq(organizations.id, organizationId), eq(organizations.status, 'active')))
      .limit(1);
    const organization = rows[0];
    if (!organization) return undefined;
    await this.setOrganizationContext(organization.id);
    const role = await this.findActiveRole(organization.id, principalId);
    return role ? { ...organization, role } : undefined;
  }

  async createOrganization(input: {
    id: string;
    principalId: string;
    name: string;
    slug: string;
  }): Promise<OrganizationEntity> {
    await this.transaction.insert(organizations).values({
      id: input.id,
      createdBy: input.principalId,
      name: input.name,
      slug: input.slug,
    });

    await this.lockOrganization(input.id);
    await this.transaction.insert(organizationMemberships).values({
      organizationId: input.id,
      userId: input.principalId,
      role: 'owner',
    });
    return { id: input.id, name: input.name, slug: input.slug, role: 'owner' };
  }

  async listMembers(organizationId: string): Promise<OrganizationMemberEntity[]> {
    return this.transaction
      .select({
        userId: organizationMemberships.userId,
        email: userProfiles.email,
        role: organizationMemberships.role,
        joinedAt: organizationMemberships.joinedAt,
      })
      .from(organizationMemberships)
      .innerJoin(userProfiles, eq(userProfiles.id, organizationMemberships.userId))
      .where(
        and(
          eq(organizationMemberships.organizationId, organizationId),
          eq(organizationMemberships.status, 'active'),
        ),
      )
      .orderBy(asc(userProfiles.email), asc(organizationMemberships.userId))
      .limit(MEMBER_LIST_LIMIT);
  }

  async findMember(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationMemberEntity | undefined> {
    const rows = await this.transaction
      .select({
        userId: organizationMemberships.userId,
        email: userProfiles.email,
        role: organizationMemberships.role,
        joinedAt: organizationMemberships.joinedAt,
      })
      .from(organizationMemberships)
      .innerJoin(userProfiles, eq(userProfiles.id, organizationMemberships.userId))
      .where(
        and(
          eq(organizationMemberships.organizationId, organizationId),
          eq(organizationMemberships.userId, userId),
          eq(organizationMemberships.status, 'active'),
        ),
      )
      .limit(1);
    return rows[0];
  }

  async updateMemberRole(
    organizationId: string,
    userId: string,
    role: OrganizationRole,
  ): Promise<OrganizationMemberEntity | undefined> {
    const rows = await this.transaction
      .update(organizationMemberships)
      .set({ role, updatedAt: new Date() })
      .where(
        and(
          eq(organizationMemberships.organizationId, organizationId),
          eq(organizationMemberships.userId, userId),
          eq(organizationMemberships.status, 'active'),
        ),
      )
      .returning({ userId: organizationMemberships.userId });
    return rows[0] ? this.findMember(organizationId, rows[0].userId) : undefined;
  }

  async revokeMember(organizationId: string, userId: string, revokedBy: string): Promise<boolean> {
    const now = new Date();
    const rows = await this.transaction
      .update(organizationMemberships)
      .set({ status: 'revoked', revokedAt: now, revokedBy, updatedAt: now })
      .where(
        and(
          eq(organizationMemberships.organizationId, organizationId),
          eq(organizationMemberships.userId, userId),
          eq(organizationMemberships.status, 'active'),
        ),
      )
      .returning({ userId: organizationMemberships.userId });
    return rows.length === 1;
  }

  async cancelPendingInvitations(
    organizationId: string,
    invitedUserId: string,
    cancelledAt: Date,
  ): Promise<void> {
    await this.transaction
      .update(organizationInvitations)
      .set({ status: 'cancelled', cancelledAt, updatedAt: cancelledAt })
      .where(
        and(
          eq(organizationInvitations.organizationId, organizationId),
          eq(organizationInvitations.invitedUserId, invitedUserId),
          eq(organizationInvitations.status, 'pending'),
        ),
      );
  }

  async resolveInvitedUser(email: string, role: OrganizationRole): Promise<string | undefined> {
    const result = await this.transaction.execute<{ id: string | null }>(
      sql`select app_private.resolve_invited_user(${email}, ${role}::organization_role) as id`,
    );
    return result.rows[0]?.id ?? undefined;
  }

  async createInvitation(input: {
    id: string;
    organization: OrganizationEntity;
    invitedUserId: string;
    role: OrganizationRole;
    invitedBy: string;
    expiresAt: Date;
  }): Promise<OrganizationInvitationEntity> {
    await this.transaction.insert(organizationInvitations).values({
      id: input.id,
      organizationId: input.organization.id,
      invitedUserId: input.invitedUserId,
      role: input.role,
      invitedBy: input.invitedBy,
      expiresAt: input.expiresAt,
    });
    return {
      id: input.id,
      organization: {
        id: input.organization.id,
        name: input.organization.name,
        slug: input.organization.slug,
      },
      role: input.role,
      expiresAt: input.expiresAt,
    };
  }

  async listPendingInvitations(
    principalId: string,
    now: Date,
  ): Promise<OrganizationInvitationEntity[]> {
    return this.transaction
      .select({
        id: organizationInvitations.id,
        organization: {
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
        },
        role: organizationInvitations.role,
        expiresAt: organizationInvitations.expiresAt,
      })
      .from(organizationInvitations)
      .innerJoin(organizations, eq(organizations.id, organizationInvitations.organizationId))
      .where(
        and(
          eq(organizationInvitations.invitedUserId, principalId),
          eq(organizationInvitations.status, 'pending'),
          gt(organizationInvitations.expiresAt, now),
          eq(organizations.status, 'active'),
        ),
      )
      .orderBy(asc(organizationInvitations.expiresAt), asc(organizationInvitations.id))
      .limit(INVITATION_LIST_LIMIT);
  }

  async findInvitationForRecipient(
    invitationId: string,
    principalId: string,
  ): Promise<InvitationStateEntity | undefined> {
    const rows = await this.transaction
      .select({
        id: organizationInvitations.id,
        organizationId: organizationInvitations.organizationId,
        invitedUserId: organizationInvitations.invitedUserId,
        invitedBy: organizationInvitations.invitedBy,
        role: organizationInvitations.role,
        status: organizationInvitations.status,
        expiresAt: organizationInvitations.expiresAt,
      })
      .from(organizationInvitations)
      .where(
        and(
          eq(organizationInvitations.id, invitationId),
          eq(organizationInvitations.invitedUserId, principalId),
        ),
      )
      .limit(1);
    return rows[0];
  }

  async activateInvitedMembership(invitation: InvitationStateEntity): Promise<void> {
    const now = new Date();
    const updated = await this.transaction
      .update(organizationMemberships)
      .set({
        role: invitation.role,
        status: 'active',
        invitedBy: invitation.invitedBy,
        joinedAt: now,
        updatedAt: now,
        revokedAt: null,
        revokedBy: null,
      })
      .where(
        and(
          eq(organizationMemberships.organizationId, invitation.organizationId),
          eq(organizationMemberships.userId, invitation.invitedUserId),
          eq(organizationMemberships.status, 'revoked'),
        ),
      )
      .returning({ userId: organizationMemberships.userId });
    if (updated.length > 0) return;

    await this.transaction.insert(organizationMemberships).values({
      organizationId: invitation.organizationId,
      userId: invitation.invitedUserId,
      role: invitation.role,
      invitedBy: invitation.invitedBy,
    });
  }

  async acceptInvitation(invitationId: string, acceptedAt: Date): Promise<boolean> {
    const rows = await this.transaction
      .update(organizationInvitations)
      .set({ status: 'accepted', acceptedAt, updatedAt: acceptedAt })
      .where(
        and(
          eq(organizationInvitations.id, invitationId),
          eq(organizationInvitations.status, 'pending'),
          gt(organizationInvitations.expiresAt, acceptedAt),
        ),
      )
      .returning({ id: organizationInvitations.id });
    return rows.length === 1;
  }

  async hasActiveMembership(organizationId: string, userId: string): Promise<boolean> {
    const rows = await this.transaction
      .select({ userId: organizationMemberships.userId })
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.organizationId, organizationId),
          eq(organizationMemberships.userId, userId),
          eq(organizationMemberships.status, 'active'),
        ),
      )
      .limit(1);
    return rows.length === 1;
  }

  private async findActiveRole(
    organizationId: string,
    principalId: string,
  ): Promise<OrganizationRole | undefined> {
    const rows = await this.transaction
      .select({ role: organizationMemberships.role })
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.organizationId, organizationId),
          eq(organizationMemberships.userId, principalId),
          eq(organizationMemberships.status, 'active'),
        ),
      )
      .limit(1);
    return rows[0]?.role;
  }
}

async function syncUserProfile(
  transaction: DatabaseTransaction,
  principal: { id: string; email: string },
): Promise<void> {
  const email = principal.email.trim().toLowerCase();
  await transaction
    .insert(userProfiles)
    .values({ id: principal.id, email })
    .onConflictDoUpdate({
      target: userProfiles.id,
      set: { email, updatedAt: new Date() },
    });
}

function mapDatabaseError(error: unknown): OrganizationRepositoryError {
  const code = getErrorCode(error);
  if (code === '23505' || code === '23514' || code === '23P01') {
    return new OrganizationRepositoryError('conflict');
  }
  if (code === '42501') return new OrganizationRepositoryError('forbidden');
  return new OrganizationRepositoryError('unavailable');
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
}
