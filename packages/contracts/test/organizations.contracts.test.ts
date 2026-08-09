import { describe, expect, it } from 'vitest';
import {
  createOrganizationInvitationRequestSchema,
  createOrganizationRequestSchema,
  organizationSchema,
} from '../src/index.js';

describe('organization contracts', () => {
  it('accepts canonical organization slugs', () => {
    expect(createOrganizationRequestSchema.parse({ name: 'ArcSyn', slug: 'arcsyn-shift' })).toEqual(
      {
        name: 'ArcSyn',
        slug: 'arcsyn-shift',
      },
    );
  });

  it.each(['Uppercase', '-prefix', 'suffix-', 'two--hyphens', 'ab'])(
    'rejects invalid slug %s',
    (slug) => {
      expect(createOrganizationRequestSchema.safeParse({ name: 'ArcSyn', slug }).success).toBe(
        false,
      );
    },
  );

  it('normalizes invitation email and validates its role', () => {
    expect(
      createOrganizationInvitationRequestSchema.parse({
        email: ' MEMBER@EXAMPLE.COM ',
        role: 'member',
      }),
    ).toEqual({ email: 'member@example.com', role: 'member' });
  });

  it('rejects response fields outside the public contract', () => {
    expect(
      organizationSchema.safeParse({
        id: '84c326ab-69e5-44bc-8f86-1a46b47c56c8',
        name: 'ArcSyn',
        slug: 'arcsyn',
        role: 'owner',
        secret: 'not-public',
      }).success,
    ).toBe(false);
  });
});
