import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type {
  AcceptOrganizationInvitationCommand,
  CreateOrganizationCommand,
  CreateOrganizationInvitationCommand,
  GetOrganizationCommand,
  ListOrganizationInvitationsCommand,
  ListOrganizationMembersCommand,
  ListOrganizationsCommand,
  RevokeOrganizationMemberCommand,
  UpdateOrganizationMemberCommand,
} from './commands/organizations.command.js';
import type {
  OrganizationInvitationResult,
  OrganizationInvitationsResult,
  OrganizationMemberResult,
  OrganizationMembersResult,
  OrganizationResult,
  OrganizationsResult,
} from './results/organizations.result.js';
import { canInvite, canRevokeMember, canUpdateMemberRole } from '../domain/organization-rbac.js';
import { OrganizationsError } from '../organizations.error.js';
import {
  OrganizationRepositoryError,
  type OrganizationsUnitOfWork,
} from '../repository/organizations.repository.js';

type OrganizationsRepositoryPort =
  import('../repository/organizations.repository.js').OrganizationsRepository;

const INVITATION_VALIDITY_MS = 7 * 24 * 60 * 60 * 1_000;

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly repository: OrganizationsRepositoryPort,
    private readonly generateId: () => string = randomUUID,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(command: ListOrganizationsCommand): Promise<OrganizationsResult> {
    return this.run(command.principal, async (unitOfWork) => ({
      organizations: await unitOfWork.listOrganizations(),
    }));
  }

  async create(command: CreateOrganizationCommand): Promise<OrganizationResult> {
    return this.run(command.principal, async (unitOfWork) => {
      const id = this.generateId();
      await unitOfWork.setOrganizationContext(id);
      return unitOfWork.createOrganization({
        id,
        principalId: command.principal.id,
        name: command.name,
        slug: command.slug,
      });
    });
  }

  async get(command: GetOrganizationCommand): Promise<OrganizationResult> {
    return this.run(command.principal, async (unitOfWork) =>
      this.requireOrganization(unitOfWork, command.principal.id, command.slug),
    );
  }

  async listMembers(command: ListOrganizationMembersCommand): Promise<OrganizationMembersResult> {
    return this.run(command.principal, async (unitOfWork) => {
      const organization = await this.requireOrganization(
        unitOfWork,
        command.principal.id,
        command.slug,
      );
      await unitOfWork.setOrganizationContext(organization.id);
      const members = await unitOfWork.listMembers(organization.id);
      return { members: members.map(toMemberResult) };
    });
  }

  async updateMember(command: UpdateOrganizationMemberCommand): Promise<OrganizationMemberResult> {
    return this.run(command.principal, async (unitOfWork) => {
      const initialOrganization = await this.requireOrganization(
        unitOfWork,
        command.principal.id,
        command.slug,
      );
      await unitOfWork.setOrganizationContext(initialOrganization.id);
      await unitOfWork.lockOrganization(initialOrganization.id);
      const organization = await this.requireOrganization(
        unitOfWork,
        command.principal.id,
        command.slug,
      );
      if (!canUpdateMemberRole(organization.role)) throw new OrganizationsError('forbidden');

      const target = await unitOfWork.findMember(organization.id, command.userId);
      if (!target) throw new OrganizationsError('not_found');
      const updated = await unitOfWork.updateMemberRole(
        organization.id,
        command.userId,
        command.role,
      );
      if (!updated) throw new OrganizationsError('not_found');
      return toMemberResult(updated);
    });
  }

  async revokeMember(command: RevokeOrganizationMemberCommand): Promise<void> {
    await this.run(command.principal, async (unitOfWork) => {
      const initialOrganization = await this.requireOrganization(
        unitOfWork,
        command.principal.id,
        command.slug,
      );
      await unitOfWork.setOrganizationContext(initialOrganization.id);
      await unitOfWork.lockOrganization(initialOrganization.id);
      const organization = await this.requireOrganization(
        unitOfWork,
        command.principal.id,
        command.slug,
      );
      const target = await unitOfWork.findMember(organization.id, command.userId);
      if (!target) throw new OrganizationsError('not_found');
      if (
        !canRevokeMember(organization.role, target.role, command.principal.id === command.userId)
      ) {
        throw new OrganizationsError('forbidden');
      }
      await unitOfWork.cancelPendingInvitations(organization.id, command.userId, this.now());
      if (!(await unitOfWork.revokeMember(organization.id, command.userId, command.principal.id))) {
        throw new OrganizationsError('conflict');
      }
    });
  }

  async createInvitation(
    command: CreateOrganizationInvitationCommand,
  ): Promise<OrganizationInvitationResult> {
    return this.run(command.principal, async (unitOfWork) => {
      const organization = await this.requireOrganization(
        unitOfWork,
        command.principal.id,
        command.slug,
      );
      await unitOfWork.setOrganizationContext(organization.id);
      if (!canInvite(organization.role, command.role)) {
        throw new OrganizationsError('forbidden');
      }

      const invitedUserId = await unitOfWork.resolveInvitedUser(command.email, command.role);
      if (!invitedUserId) throw new OrganizationsError('user_not_found');
      if (await unitOfWork.findMember(organization.id, invitedUserId)) {
        throw new OrganizationsError('conflict');
      }

      const expiresAt = new Date(this.now().getTime() + INVITATION_VALIDITY_MS);
      const invitation = await unitOfWork.createInvitation({
        id: this.generateId(),
        organization,
        invitedUserId,
        role: command.role,
        invitedBy: command.principal.id,
        expiresAt,
      });
      return toInvitationResult(invitation);
    });
  }

  async listInvitations(
    command: ListOrganizationInvitationsCommand,
  ): Promise<OrganizationInvitationsResult> {
    return this.run(command.principal, async (unitOfWork) => ({
      invitations: (await unitOfWork.listPendingInvitations(command.principal.id, this.now())).map(
        toInvitationResult,
      ),
    }));
  }

  async acceptInvitation(
    command: AcceptOrganizationInvitationCommand,
  ): Promise<OrganizationResult> {
    return this.run(command.principal, async (unitOfWork) => {
      const initialInvitation = await unitOfWork.findInvitationForRecipient(
        command.invitationId,
        command.principal.id,
      );
      if (!initialInvitation) throw new OrganizationsError('invitation_invalid');

      if (initialInvitation.status !== 'pending' && initialInvitation.status !== 'accepted') {
        throw new OrganizationsError('invitation_invalid');
      }
      if (initialInvitation.status === 'pending' && initialInvitation.expiresAt <= this.now()) {
        throw new OrganizationsError('invitation_invalid');
      }

      await unitOfWork.setOrganizationContext(initialInvitation.organizationId);
      if (
        initialInvitation.status === 'accepted' &&
        !(await unitOfWork.hasActiveMembership(
          initialInvitation.organizationId,
          command.principal.id,
        ))
      ) {
        throw new OrganizationsError('invitation_invalid');
      }
      await unitOfWork.lockOrganization(initialInvitation.organizationId);
      const invitation = await unitOfWork.findInvitationForRecipient(
        command.invitationId,
        command.principal.id,
      );
      if (!invitation) throw new OrganizationsError('invitation_invalid');
      if (invitation.status === 'accepted') {
        const active = await unitOfWork.hasActiveMembership(
          invitation.organizationId,
          command.principal.id,
        );
        if (!active) throw new OrganizationsError('invitation_invalid');
        const organization = await unitOfWork.findOrganizationById(
          command.principal.id,
          invitation.organizationId,
        );
        if (!organization) throw new OrganizationsError('invitation_invalid');
        return organization;
      }

      if (invitation.status !== 'pending' || invitation.expiresAt <= this.now()) {
        throw new OrganizationsError('invitation_invalid');
      }

      await unitOfWork.activateInvitedMembership(invitation);
      if (!(await unitOfWork.acceptInvitation(invitation.id, this.now()))) {
        throw new OrganizationsError('invitation_invalid');
      }
      const organization = await unitOfWork.findOrganizationById(
        command.principal.id,
        invitation.organizationId,
      );
      if (!organization) throw new OrganizationsError('invitation_invalid');
      return organization;
    });
  }

  private async requireOrganization(
    unitOfWork: OrganizationsUnitOfWork,
    principalId: string,
    slug: string,
  ): Promise<OrganizationResult> {
    const organization = await unitOfWork.findOrganizationBySlug(principalId, slug);
    if (!organization) throw new OrganizationsError('not_found');
    return organization;
  }

  private async run<T>(
    principal: { id: string; email: string },
    operation: (unitOfWork: OrganizationsUnitOfWork) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.repository.withPrincipal(principal, operation);
    } catch (error) {
      if (error instanceof OrganizationsError) throw error;
      if (error instanceof OrganizationRepositoryError) {
        if (error.kind === 'conflict') throw new OrganizationsError('conflict');
        if (error.kind === 'forbidden') throw new OrganizationsError('forbidden');
      }
      throw new OrganizationsError('unavailable');
    }
  }
}

function toMemberResult(member: {
  userId: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: Date;
}): OrganizationMemberResult {
  return { ...member, joinedAt: member.joinedAt.toISOString() };
}

function toInvitationResult(invitation: {
  id: string;
  organization: { id: string; name: string; slug: string };
  role: 'owner' | 'admin' | 'member';
  expiresAt: Date;
}): OrganizationInvitationResult {
  return { ...invitation, expiresAt: invitation.expiresAt.toISOString() };
}
