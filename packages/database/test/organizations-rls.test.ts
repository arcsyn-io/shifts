import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationUrl = new URL('../drizzle/0001_overrated_virginia_dare.sql', import.meta.url);

describe('organizations RLS migration', () => {
  it('forces RLS on every organization-owned table', async () => {
    const migration = await readFile(migrationUrl, 'utf8');

    for (const table of [
      'user_profiles',
      'organizations',
      'organization_memberships',
      'organization_invitations',
    ]) {
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(migration).toContain(`ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY`);
    }
  });

  it('uses a non-privileged runtime role and transaction-scoped context', async () => {
    const [migration, databaseSource] = await Promise.all([
      readFile(migrationUrl, 'utf8'),
      readFile(new URL('../src/index.ts', import.meta.url), 'utf8'),
    ]);

    expect(migration).toMatch(/arcsyn_shift_runtime NOLOGIN NOSUPERUSER[^;]+NOBYPASSRLS/);
    expect(migration).toContain('GRANT arcsyn_shift_runtime TO CURRENT_USER WITH SET TRUE');
    expect(databaseSource).toContain('set local role arcsyn_shift_runtime');
    expect(databaseSource).toContain("set_config('app.current_user_id'");
    expect(databaseSource).toContain("set_config('app.current_organization_id'");
  });

  it('limits pending invitations to their recipient', async () => {
    const migration = await readFile(migrationUrl, 'utf8');
    const policy = migration.match(
      /CREATE POLICY invitations_recipient_or_member_select[\s\S]*?statement-breakpoint/,
    )?.[0];

    expect(policy).toContain('invited_user_id = app_private.current_user_id()');
    expect(policy).not.toContain('is_active_member');
  });

  it('serializes the last-owner invariant by organization', async () => {
    const migration = await readFile(migrationUrl, 'utf8');
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('app.locked_organization_id');
    expect(migration).toContain('app_private.has_organization_lock(organization_id)');
    expect(migration).toContain('organization must retain an owner');
  });

  it('limits membership reads to the explicit organization context', async () => {
    const migration = await readFile(migrationUrl, 'utf8');
    const policy = migration.match(
      /CREATE POLICY memberships_member_select[\s\S]*?statement-breakpoint/,
    )?.[0];

    expect(policy).toContain('organization_id = app_private.current_organization_id()');
    expect(migration).toContain('app_private.list_current_user_organizations()');
  });
});
