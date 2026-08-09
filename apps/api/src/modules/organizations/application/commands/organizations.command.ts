import type { OrganizationRole } from '@arcsyn-shift/contracts';

export interface CreateOrganizationCommand {
  name: string;
  slug: string;
}

export interface GetOrganizationCommand {
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

export interface AcceptOrganizationInvitationCommand {
  invitationId: string;
}
