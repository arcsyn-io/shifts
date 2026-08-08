import type { OrganizationRole } from '@arcsyn-shift/contracts';

export interface OrganizationEntity {
  id: string;
  name: string;
  slug: string;
  role: OrganizationRole;
}

export interface OrganizationMemberEntity {
  userId: string;
  email: string;
  role: OrganizationRole;
  joinedAt: Date;
}

export interface OrganizationInvitationEntity {
  id: string;
  organization: Pick<OrganizationEntity, 'id' | 'name' | 'slug'>;
  role: OrganizationRole;
  expiresAt: Date;
}

export interface InvitationStateEntity {
  id: string;
  organizationId: string;
  invitedUserId: string;
  invitedBy: string;
  role: OrganizationRole;
  status: 'pending' | 'accepted' | 'cancelled' | 'expired';
  expiresAt: Date;
}
