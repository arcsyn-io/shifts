import { pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

export const systemHealth = pgTable('system_health', {
  id: uuid('id').defaultRandom().primaryKey(),
  checkedAt: timestamp('checked_at', { withTimezone: true }).defaultNow().notNull(),
});
