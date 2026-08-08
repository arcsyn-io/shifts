import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const organizationRole = pgEnum('organization_role', ['owner', 'admin', 'member']);
export const organizationStatus = pgEnum('organization_status', ['active']);
export const membershipStatus = pgEnum('organization_membership_status', ['active', 'revoked']);
export const invitationStatus = pgEnum('organization_invitation_status', [
  'pending',
  'accepted',
  'cancelled',
  'expired',
]);

export const systemHealth = pgTable('system_health', {
  id: uuid('id').defaultRandom().primaryKey(),
  checkedAt: timestamp('checked_at', { withTimezone: true }).defaultNow().notNull(),
});

export const userProfiles = pgTable(
  'user_profiles',
  {
    id: uuid('id').primaryKey(),
    email: text('email').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('user_profiles_email_lower_unique').on(sql`lower(${table.email})`),
    check('user_profiles_email_lowercase', sql`${table.email} = lower(${table.email})`),
  ],
);

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    status: organizationStatus('status').default('active').notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => userProfiles.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('organizations_slug_lower_unique').on(sql`lower(${table.slug})`),
    check(
      'organizations_slug_format',
      sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND char_length(${table.slug}) BETWEEN 3 AND 39`,
    ),
    check('organizations_name_length', sql`char_length(btrim(${table.name})) BETWEEN 1 AND 80`),
  ],
);

export const organizationMemberships = pgTable(
  'organization_memberships',
  {
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => userProfiles.id, { onDelete: 'restrict' }),
    role: organizationRole('role').notNull(),
    status: membershipStatus('status').default('active').notNull(),
    invitedBy: uuid('invited_by').references(() => userProfiles.id, { onDelete: 'restrict' }),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedBy: uuid('revoked_by').references(() => userProfiles.id, { onDelete: 'restrict' }),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.userId] }),
    index('organization_memberships_user_status_idx').on(table.userId, table.status),
    index('organization_memberships_org_status_role_idx').on(
      table.organizationId,
      table.status,
      table.role,
    ),
    check(
      'organization_memberships_revocation_consistent',
      sql`(${table.status} = 'active' AND ${table.revokedAt} IS NULL AND ${table.revokedBy} IS NULL)
        OR (${table.status} = 'revoked' AND ${table.revokedAt} IS NOT NULL AND ${table.revokedBy} IS NOT NULL)`,
    ),
  ],
);

export const organizationInvitations = pgTable(
  'organization_invitations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    invitedUserId: uuid('invited_user_id')
      .notNull()
      .references(() => userProfiles.id, { onDelete: 'restrict' }),
    role: organizationRole('role').notNull(),
    status: invitationStatus('status').default('pending').notNull(),
    invitedBy: uuid('invited_by')
      .notNull()
      .references(() => userProfiles.id, { onDelete: 'restrict' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('organization_invitations_recipient_status_idx').on(table.invitedUserId, table.status),
    index('organization_invitations_org_status_idx').on(table.organizationId, table.status),
    uniqueIndex('organization_invitations_pending_unique')
      .on(table.organizationId, table.invitedUserId)
      .where(sql`${table.status} = 'pending'`),
    check(
      'organization_invitations_expiry_after_creation',
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
  ],
);
