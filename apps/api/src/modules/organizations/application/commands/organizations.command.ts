import type { OrganizationRole } from '@arcsyn-shift/contracts';

export interface OrganizationPrincipal {
  id: string;
  email: string;
}

export interface ListOrganizationsCommand {
  principal: OrganizationPrincipal;
}

export interface CreateOrganizationCommand extends ListOrganizationsCommand {
  name: string;
  slug: string;
}

export interface GetOrganizationCommand extends ListOrganizationsCommand {
  slug: string;
}

export type ListOrganizationMembersCommand = GetOrganizationCommand;

export interface UpdateOrganizationMemberCommand extends GetOrganizationCommand {
  userId: string;
  role: OrganizationRole;
}

export interface RevokeOrganizationMemberCommand extends GetOrganizationCommand {
  userId: string;
}

export interface CreateOrganizationInvitationCommand extends GetOrganizationCommand {
  email: string;
  role: OrganizationRole;
}

export type ListOrganizationInvitationsCommand = ListOrganizationsCommand;

export interface AcceptOrganizationInvitationCommand extends ListOrganizationsCommand {
  invitationId: string;
}
