import type { OrganizationRole } from '@arcsyn-shift/contracts';
import type {
  InvitationStateEntity,
  OrganizationEntity,
  OrganizationInvitationEntity,
  OrganizationMemberEntity,
} from '../domain/entities/organization.entity.js';

export type OrganizationRepositoryErrorKind = 'conflict' | 'forbidden' | 'unavailable';

export class OrganizationRepositoryError extends Error {
  constructor(readonly kind: OrganizationRepositoryErrorKind) {
    super(kind);
    this.name = 'OrganizationRepositoryError';
  }
}

export interface OrganizationsRepository {
  lockOrganization(organizationId: string): Promise<void>;
  listOrganizations(): Promise<OrganizationEntity[]>;
  findOrganizationIdBySlug(slug: string): Promise<string | undefined>;
  findOrganizationById(
    principalId: string,
    organizationId: string,
  ): Promise<OrganizationEntity | undefined>;
  createOrganization(input: {
    id: string;
    principalId: string;
    name: string;
    slug: string;
  }): Promise<OrganizationEntity>;
  listMembers(organizationId: string): Promise<OrganizationMemberEntity[]>;
  findMember(organizationId: string, userId: string): Promise<OrganizationMemberEntity | undefined>;
  updateMemberRole(
    organizationId: string,
    userId: string,
    role: OrganizationRole,
  ): Promise<OrganizationMemberEntity | undefined>;
  revokeMember(organizationId: string, userId: string, revokedBy: string): Promise<boolean>;
  cancelPendingInvitations(
    organizationId: string,
    invitedUserId: string,
    cancelledAt: Date,
  ): Promise<void>;
  resolveInvitedUser(email: string, role: OrganizationRole): Promise<string | undefined>;
  createInvitation(input: {
    id: string;
    organization: OrganizationEntity;
    invitedUserId: string;
    role: OrganizationRole;
    invitedBy: string;
    expiresAt: Date;
  }): Promise<OrganizationInvitationEntity>;
  listPendingInvitations(principalId: string, now: Date): Promise<OrganizationInvitationEntity[]>;
  findInvitationForRecipient(
    invitationId: string,
    principalId: string,
  ): Promise<InvitationStateEntity | undefined>;
  activateInvitedMembership(invitation: InvitationStateEntity): Promise<void>;
  acceptInvitation(invitationId: string, acceptedAt: Date): Promise<boolean>;
  hasActiveMembership(organizationId: string, userId: string): Promise<boolean>;
}

export const ORGANIZATIONS_REPOSITORY = Symbol('ORGANIZATIONS_REPOSITORY');
