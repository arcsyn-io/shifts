import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ApplicationContext } from '../../../infrastructure/context/application-context.js';
import { TransactionManager } from '../../../infrastructure/database/transaction-manager.js';
import { Transactional } from '../../../infrastructure/database/transactional.js';
import type {
  AcceptOrganizationInvitationCommand,
  CreateOrganizationCommand,
  CreateOrganizationInvitationCommand,
  GetOrganizationCommand,
  ListOrganizationMembersCommand,
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
import { OrganizationRepositoryError } from '../repository/organizations.repository.js';

type OrganizationsRepositoryPort =
  import('../repository/organizations.repository.js').OrganizationsRepository;

const INVITATION_VALIDITY_MS = 7 * 24 * 60 * 60 * 1_000;

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly repository: OrganizationsRepositoryPort,
    private readonly applicationContext: ApplicationContext,
    readonly transactionManager: TransactionManager,
    private readonly generateId: () => string = randomUUID,
    private readonly now: () => Date = () => new Date(),
  ) {}

  @Transactional()
  async list(): Promise<OrganizationsResult> {
    return this.run(async () => ({
      organizations: await this.repository.listOrganizations(),
    }));
  }

  @Transactional()
  async create(command: CreateOrganizationCommand): Promise<OrganizationResult> {
    return this.run(async () => {
      const principal = this.applicationContext.getPrincipal();
      const id = this.generateId();
      await this.transactionManager.selectOrganization(id);
      return this.repository.createOrganization({
        id,
        principalId: principal.id,
        name: command.name,
        slug: command.slug,
      });
    });
  }

  @Transactional()
  async get(command: GetOrganizationCommand): Promise<OrganizationResult> {
    return this.run(() => this.selectOrganization(command.slug));
  }

  @Transactional()
  async listMembers(command: ListOrganizationMembersCommand): Promise<OrganizationMembersResult> {
    return this.run(async () => {
      const organization = await this.selectOrganization(command.slug);
      const members = await this.repository.listMembers(organization.id);
      return { members: members.map(toMemberResult) };
    });
  }

  @Transactional()
  async updateMember(command: UpdateOrganizationMemberCommand): Promise<OrganizationMemberResult> {
    return this.run(async () => {
      const principal = this.applicationContext.getPrincipal();
      const initialOrganization = await this.selectOrganization(command.slug);
      await this.repository.lockOrganization(initialOrganization.id);
      const organization = await this.requireSelectedOrganization(
        principal.id,
        initialOrganization.id,
      );
      if (!canUpdateMemberRole(organization.role)) throw new OrganizationsError('forbidden');

      const target = await this.repository.findMember(organization.id, command.userId);
      if (!target) throw new OrganizationsError('not_found');
      const updated = await this.repository.updateMemberRole(
        organization.id,
        command.userId,
        command.role,
      );
      if (!updated) throw new OrganizationsError('not_found');
      return toMemberResult(updated);
    });
  }

  @Transactional()
  async revokeMember(command: RevokeOrganizationMemberCommand): Promise<void> {
    await this.run(async () => {
      const principal = this.applicationContext.getPrincipal();
      const initialOrganization = await this.selectOrganization(command.slug);
      await this.repository.lockOrganization(initialOrganization.id);
      const organization = await this.requireSelectedOrganization(
        principal.id,
        initialOrganization.id,
      );
      const target = await this.repository.findMember(organization.id, command.userId);
      if (!target) throw new OrganizationsError('not_found');
      if (!canRevokeMember(organization.role, target.role, principal.id === command.userId)) {
        throw new OrganizationsError('forbidden');
      }
      await this.repository.cancelPendingInvitations(organization.id, command.userId, this.now());
      if (!(await this.repository.revokeMember(organization.id, command.userId, principal.id))) {
        throw new OrganizationsError('conflict');
      }
    });
  }

  @Transactional()
  async createInvitation(
    command: CreateOrganizationInvitationCommand,
  ): Promise<OrganizationInvitationResult> {
    return this.run(async () => {
      const principal = this.applicationContext.getPrincipal();
      const organization = await this.selectOrganization(command.slug);
      if (!canInvite(organization.role, command.role)) {
        throw new OrganizationsError('forbidden');
      }

      const invitedUserId = await this.repository.resolveInvitedUser(command.email, command.role);
      if (!invitedUserId) throw new OrganizationsError('user_not_found');
      if (await this.repository.findMember(organization.id, invitedUserId)) {
        throw new OrganizationsError('conflict');
      }

      const expiresAt = new Date(this.now().getTime() + INVITATION_VALIDITY_MS);
      const invitation = await this.repository.createInvitation({
        id: this.generateId(),
        organization,
        invitedUserId,
        role: command.role,
        invitedBy: principal.id,
        expiresAt,
      });
      return toInvitationResult(invitation);
    });
  }

  @Transactional()
  async listInvitations(): Promise<OrganizationInvitationsResult> {
    return this.run(async () => {
      const principal = this.applicationContext.getPrincipal();
      return {
        invitations: (await this.repository.listPendingInvitations(principal.id, this.now())).map(
          toInvitationResult,
        ),
      };
    });
  }

  @Transactional()
  async acceptInvitation(
    command: AcceptOrganizationInvitationCommand,
  ): Promise<OrganizationResult> {
    return this.run(async () => {
      const principal = this.applicationContext.getPrincipal();
      const initialInvitation = await this.repository.findInvitationForRecipient(
        command.invitationId,
        principal.id,
      );
      if (!initialInvitation) throw new OrganizationsError('invitation_invalid');

      if (initialInvitation.status !== 'pending' && initialInvitation.status !== 'accepted') {
        throw new OrganizationsError('invitation_invalid');
      }
      if (initialInvitation.status === 'pending' && initialInvitation.expiresAt <= this.now()) {
        throw new OrganizationsError('invitation_invalid');
      }

      await this.transactionManager.selectOrganization(initialInvitation.organizationId);
      if (
        initialInvitation.status === 'accepted' &&
        !(await this.repository.hasActiveMembership(initialInvitation.organizationId, principal.id))
      ) {
        throw new OrganizationsError('invitation_invalid');
      }
      await this.repository.lockOrganization(initialInvitation.organizationId);
      const invitation = await this.repository.findInvitationForRecipient(
        command.invitationId,
        principal.id,
      );
      if (!invitation) throw new OrganizationsError('invitation_invalid');
      if (invitation.status === 'accepted') {
        const active = await this.repository.hasActiveMembership(
          invitation.organizationId,
          principal.id,
        );
        if (!active) throw new OrganizationsError('invitation_invalid');
        const organization = await this.repository.findOrganizationById(
          principal.id,
          invitation.organizationId,
        );
        if (!organization) throw new OrganizationsError('invitation_invalid');
        return organization;
      }

      if (invitation.status !== 'pending' || invitation.expiresAt <= this.now()) {
        throw new OrganizationsError('invitation_invalid');
      }

      await this.repository.activateInvitedMembership(invitation);
      if (!(await this.repository.acceptInvitation(invitation.id, this.now()))) {
        throw new OrganizationsError('invitation_invalid');
      }
      const organization = await this.repository.findOrganizationById(
        principal.id,
        invitation.organizationId,
      );
      if (!organization) throw new OrganizationsError('invitation_invalid');
      return organization;
    });
  }

  private async requireSelectedOrganization(
    principalId: string,
    organizationId: string,
  ): Promise<OrganizationResult> {
    const organization = await this.repository.findOrganizationById(principalId, organizationId);
    if (!organization) throw new OrganizationsError('not_found');
    return organization;
  }

  private async selectOrganization(slug: string): Promise<OrganizationResult> {
    const principal = this.applicationContext.getPrincipal();
    const organizationId = await this.repository.findOrganizationIdBySlug(slug);
    if (!organizationId) throw new OrganizationsError('not_found');
    await this.transactionManager.selectOrganization(organizationId);
    return this.requireSelectedOrganization(principal.id, organizationId);
  }

  private async run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
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
