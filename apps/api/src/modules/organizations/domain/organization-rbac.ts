import type { OrganizationRole } from '@arcsyn-shift/contracts';

export function canInvite(actorRole: OrganizationRole, invitedRole: OrganizationRole): boolean {
  if (actorRole === 'owner') return true;
  return actorRole === 'admin' && invitedRole === 'member';
}

export function canUpdateMemberRole(actorRole: OrganizationRole): boolean {
  return actorRole === 'owner';
}

export function canRevokeMember(
  actorRole: OrganizationRole,
  targetRole: OrganizationRole,
  isSelf: boolean,
): boolean {
  if (isSelf) return false;
  if (actorRole === 'owner') return true;
  return actorRole === 'admin' && targetRole === 'member';
}
