import { describe, expect, it } from 'vitest';
import {
  canInvite,
  canRevokeMember,
  canUpdateMemberRole,
} from '../src/modules/organizations/domain/organization-rbac.js';

describe('organizations RBAC', () => {
  it.each([
    ['owner', 'owner', true],
    ['owner', 'admin', true],
    ['owner', 'member', true],
    ['admin', 'owner', false],
    ['admin', 'admin', false],
    ['admin', 'member', true],
    ['member', 'member', false],
  ] as const)('%s inviting %s is %s', (actorRole, invitedRole, expected) => {
    expect(canInvite(actorRole, invitedRole)).toBe(expected);
  });

  it.each([
    ['owner', true],
    ['admin', false],
    ['member', false],
  ] as const)('%s changing a role is %s', (actorRole, expected) => {
    expect(canUpdateMemberRole(actorRole)).toBe(expected);
  });

  it.each([
    ['owner', 'owner', false, true],
    ['owner', 'admin', false, true],
    ['owner', 'member', false, true],
    ['admin', 'owner', false, false],
    ['admin', 'admin', false, false],
    ['admin', 'member', false, true],
    ['member', 'member', false, false],
    ['owner', 'owner', true, false],
    ['admin', 'admin', true, false],
  ] as const)('%s revoking %s with self=%s is %s', (actorRole, targetRole, isSelf, expected) => {
    expect(canRevokeMember(actorRole, targetRole, isSelf)).toBe(expected);
  });
});
