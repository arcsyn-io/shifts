CREATE TYPE "public"."organization_invitation_status" AS ENUM('pending', 'accepted', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."organization_membership_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."organization_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."organization_status" AS ENUM('active');--> statement-breakpoint
CREATE TABLE "organization_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"invited_user_id" uuid NOT NULL,
	"role" "organization_role" NOT NULL,
	"status" "organization_invitation_status" DEFAULT 'pending' NOT NULL,
	"invited_by" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_invitations_expiry_after_creation" CHECK ("organization_invitations"."expires_at" > "organization_invitations"."created_at")
);
--> statement-breakpoint
CREATE TABLE "organization_memberships" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "organization_role" NOT NULL,
	"status" "organization_membership_status" DEFAULT 'active' NOT NULL,
	"invited_by" uuid,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid,
	CONSTRAINT "organization_memberships_organization_id_user_id_pk" PRIMARY KEY("organization_id","user_id"),
	CONSTRAINT "organization_memberships_revocation_consistent" CHECK (("organization_memberships"."status" = 'active' AND "organization_memberships"."revoked_at" IS NULL AND "organization_memberships"."revoked_by" IS NULL)
        OR ("organization_memberships"."status" = 'revoked' AND "organization_memberships"."revoked_at" IS NOT NULL AND "organization_memberships"."revoked_by" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" "organization_status" DEFAULT 'active' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_format" CHECK ("organizations"."slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND char_length("organizations"."slug") BETWEEN 3 AND 39),
	CONSTRAINT "organizations_name_length" CHECK (char_length(btrim("organizations"."name")) BETWEEN 1 AND 80)
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_email_lowercase" CHECK ("user_profiles"."email" = lower("user_profiles"."email"))
);
--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_invited_user_id_user_profiles_id_fk" FOREIGN KEY ("invited_user_id") REFERENCES "public"."user_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_invited_by_user_profiles_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_invited_by_user_profiles_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_revoked_by_user_profiles_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."user_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_created_by_user_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organization_invitations_recipient_status_idx" ON "organization_invitations" USING btree ("invited_user_id","status");--> statement-breakpoint
CREATE INDEX "organization_invitations_org_status_idx" ON "organization_invitations" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_invitations_pending_unique" ON "organization_invitations" USING btree ("organization_id","invited_user_id") WHERE "organization_invitations"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "organization_memberships_user_status_idx" ON "organization_memberships" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "organization_memberships_org_status_role_idx" ON "organization_memberships" USING btree ("organization_id","status","role");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_lower_unique" ON "organizations" USING btree (lower("slug"));--> statement-breakpoint
CREATE UNIQUE INDEX "user_profiles_email_lower_unique" ON "user_profiles" USING btree (lower("email"));--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arcsyn_shift_runtime') THEN
    CREATE ROLE arcsyn_shift_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arcsyn_shift_rls') THEN
    CREATE ROLE arcsyn_shift_rls NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
  END IF;
END
$$;--> statement-breakpoint
GRANT arcsyn_shift_runtime TO CURRENT_USER WITH SET TRUE;--> statement-breakpoint
GRANT arcsyn_shift_rls TO CURRENT_USER WITH SET TRUE;--> statement-breakpoint

CREATE SCHEMA IF NOT EXISTS app_private;--> statement-breakpoint
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;--> statement-breakpoint
GRANT USAGE ON SCHEMA app_private TO arcsyn_shift_runtime;--> statement-breakpoint
GRANT USAGE ON SCHEMA app_private TO arcsyn_shift_rls;--> statement-breakpoint
GRANT CREATE ON SCHEMA app_private TO arcsyn_shift_rls;--> statement-breakpoint

CREATE FUNCTION app_private.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $$
  SELECT nullif(current_setting('app.current_user_id', true), '')::uuid
$$;--> statement-breakpoint

CREATE FUNCTION app_private.current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $$
  SELECT nullif(current_setting('app.current_organization_id', true), '')::uuid
$$;--> statement-breakpoint

CREATE FUNCTION app_private.is_active_member(target_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships membership
    WHERE membership.organization_id = target_organization_id
      AND membership.user_id = app_private.current_user_id()
      AND membership.status = 'active'
  )
$$;--> statement-breakpoint

CREATE FUNCTION app_private.current_organization_role(target_organization_id uuid)
RETURNS public.organization_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT membership.role
  FROM public.organization_memberships membership
  WHERE membership.organization_id = target_organization_id
    AND membership.user_id = app_private.current_user_id()
    AND membership.status = 'active'
$$;--> statement-breakpoint

CREATE FUNCTION app_private.can_invite(
  target_organization_id uuid,
  invited_role public.organization_role
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT CASE app_private.current_organization_role(target_organization_id)
    WHEN 'owner' THEN true
    WHEN 'admin' THEN invited_role = 'member'
    ELSE false
  END
$$;--> statement-breakpoint

CREATE FUNCTION app_private.can_manage_membership(
  target_organization_id uuid,
  target_user_id uuid,
  target_role public.organization_role
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT CASE app_private.current_organization_role(target_organization_id)
    WHEN 'owner' THEN true
    WHEN 'admin' THEN target_user_id <> app_private.current_user_id()
      AND target_role = 'member'
      AND NOT EXISTS (
        SELECT 1
        FROM public.organization_invitations invitation
        WHERE invitation.organization_id = target_organization_id
          AND invitation.invited_user_id = target_user_id
          AND invitation.status = 'pending'
          AND invitation.role <> 'member'
          AND invitation.expires_at > statement_timestamp()
      )
    ELSE false
  END
$$;--> statement-breakpoint

CREATE FUNCTION app_private.can_activate_membership(
  target_organization_id uuid,
  target_user_id uuid,
  target_role public.organization_role
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT (
    target_user_id = app_private.current_user_id()
    AND target_role = 'owner'
    AND EXISTS (
      SELECT 1 FROM public.organizations organization
      WHERE organization.id = target_organization_id
        AND organization.created_by = app_private.current_user_id()
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.organization_memberships membership
      WHERE membership.organization_id = target_organization_id
    )
  ) OR (
    target_user_id = app_private.current_user_id()
    AND EXISTS (
      SELECT 1 FROM public.organization_invitations invitation
      WHERE invitation.organization_id = target_organization_id
        AND invitation.invited_user_id = target_user_id
        AND invitation.role = target_role
        AND invitation.status = 'pending'
        AND invitation.expires_at > statement_timestamp()
    )
  )
$$;--> statement-breakpoint

CREATE FUNCTION app_private.can_accept_invitation(
  target_organization_id uuid,
  target_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT target_user_id = app_private.current_user_id()
    AND EXISTS (
      SELECT 1 FROM public.organization_invitations invitation
      WHERE invitation.organization_id = target_organization_id
        AND invitation.invited_user_id = target_user_id
        AND invitation.status = 'pending'
        AND invitation.expires_at > statement_timestamp()
    )
$$;--> statement-breakpoint

CREATE FUNCTION app_private.resolve_invited_user(
  invited_email text,
  invited_role public.organization_role
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT profile.id
  FROM public.user_profiles profile
  WHERE profile.email = lower(invited_email)
    AND app_private.can_invite(app_private.current_organization_id(), invited_role)
$$;--> statement-breakpoint

CREATE FUNCTION app_private.has_organization_lock(target_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $$
  SELECT nullif(current_setting('app.locked_organization_id', true), '')::uuid
    = target_organization_id
$$;--> statement-breakpoint

CREATE FUNCTION app_private.lock_organization(target_organization_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF target_organization_id <> app_private.current_organization_id() THEN
    RAISE EXCEPTION 'organization context mismatch' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    app_private.is_active_member(target_organization_id)
    OR EXISTS (
      SELECT 1 FROM public.organization_invitations invitation
      WHERE invitation.organization_id = target_organization_id
        AND invitation.invited_user_id = app_private.current_user_id()
        AND invitation.status = 'pending'
        AND invitation.expires_at > statement_timestamp()
    )
    OR EXISTS (
      SELECT 1 FROM public.organizations organization
      WHERE organization.id = target_organization_id
        AND organization.created_by = app_private.current_user_id()
        AND NOT EXISTS (
          SELECT 1 FROM public.organization_memberships membership
          WHERE membership.organization_id = target_organization_id
        )
    )
  ) THEN
    RAISE EXCEPTION 'organization lock is forbidden' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(target_organization_id::text, 0));
  PERFORM set_config('app.locked_organization_id', target_organization_id::text, true);
END
$$;--> statement-breakpoint

CREATE FUNCTION app_private.list_current_user_organizations()
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  role public.organization_role
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT organization.id, organization.name, organization.slug, membership.role
  FROM public.organization_memberships membership
  INNER JOIN public.organizations organization ON organization.id = membership.organization_id
  WHERE membership.user_id = app_private.current_user_id()
    AND membership.status = 'active'
    AND organization.status = 'active'
  ORDER BY organization.name, organization.id
$$;--> statement-breakpoint

ALTER FUNCTION app_private.is_active_member(uuid) OWNER TO arcsyn_shift_rls;--> statement-breakpoint
ALTER FUNCTION app_private.current_organization_role(uuid) OWNER TO arcsyn_shift_rls;--> statement-breakpoint
ALTER FUNCTION app_private.can_invite(uuid, public.organization_role) OWNER TO arcsyn_shift_rls;--> statement-breakpoint
ALTER FUNCTION app_private.can_manage_membership(uuid, uuid, public.organization_role) OWNER TO arcsyn_shift_rls;--> statement-breakpoint
ALTER FUNCTION app_private.can_activate_membership(uuid, uuid, public.organization_role) OWNER TO arcsyn_shift_rls;--> statement-breakpoint
ALTER FUNCTION app_private.can_accept_invitation(uuid, uuid) OWNER TO arcsyn_shift_rls;--> statement-breakpoint
ALTER FUNCTION app_private.resolve_invited_user(text, public.organization_role) OWNER TO arcsyn_shift_rls;--> statement-breakpoint
ALTER FUNCTION app_private.lock_organization(uuid) OWNER TO arcsyn_shift_rls;--> statement-breakpoint
ALTER FUNCTION app_private.list_current_user_organizations() OWNER TO arcsyn_shift_rls;--> statement-breakpoint

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app_private TO arcsyn_shift_runtime;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_private.current_user_id(),
  app_private.current_organization_id() TO arcsyn_shift_rls;--> statement-breakpoint
GRANT SELECT ON public.organizations, public.organization_memberships,
  public.organization_invitations TO arcsyn_shift_rls;--> statement-breakpoint

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.user_profiles FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.organization_memberships FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.organization_invitations FORCE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY user_profiles_organization_select ON public.user_profiles
  FOR SELECT TO arcsyn_shift_runtime
  USING (
    id = app_private.current_user_id()
    OR (
      app_private.current_organization_id() IS NOT NULL
      AND app_private.is_active_member(app_private.current_organization_id())
      AND EXISTS (
        SELECT 1
        FROM public.organization_memberships membership
        WHERE membership.organization_id = app_private.current_organization_id()
          AND membership.user_id = id
          AND membership.status = 'active'
      )
    )
  );--> statement-breakpoint
CREATE POLICY user_profiles_self_insert ON public.user_profiles
  FOR INSERT TO arcsyn_shift_runtime
  WITH CHECK (id = app_private.current_user_id() AND email = lower(email));--> statement-breakpoint
CREATE POLICY user_profiles_self_update ON public.user_profiles
  FOR UPDATE TO arcsyn_shift_runtime
  USING (id = app_private.current_user_id())
  WITH CHECK (id = app_private.current_user_id() AND email = lower(email));--> statement-breakpoint

CREATE POLICY organizations_member_select ON public.organizations
  FOR SELECT TO arcsyn_shift_runtime
  USING (
    app_private.is_active_member(id)
    OR EXISTS (
      SELECT 1
      FROM public.organization_invitations invitation
      WHERE invitation.organization_id = id
        AND invitation.invited_user_id = app_private.current_user_id()
        AND invitation.status = 'pending'
        AND invitation.expires_at > statement_timestamp()
    )
  );--> statement-breakpoint
CREATE POLICY organizations_authenticated_insert ON public.organizations
  FOR INSERT TO arcsyn_shift_runtime
  WITH CHECK (
    created_by = app_private.current_user_id()
    AND id = app_private.current_organization_id()
  );--> statement-breakpoint

CREATE POLICY memberships_member_select ON public.organization_memberships
  FOR SELECT TO arcsyn_shift_runtime
  USING (
    organization_id = app_private.current_organization_id()
    AND app_private.is_active_member(organization_id)
  );--> statement-breakpoint
CREATE POLICY memberships_authorized_insert ON public.organization_memberships
  FOR INSERT TO arcsyn_shift_runtime
  WITH CHECK (
    organization_id = app_private.current_organization_id()
    AND app_private.has_organization_lock(organization_id)
    AND status = 'active'
    AND app_private.can_activate_membership(organization_id, user_id, role)
  );--> statement-breakpoint
CREATE POLICY memberships_authorized_update ON public.organization_memberships
  FOR UPDATE TO arcsyn_shift_runtime
  USING (
    organization_id = app_private.current_organization_id()
    AND app_private.has_organization_lock(organization_id)
    AND (
      app_private.can_manage_membership(organization_id, user_id, role)
      OR app_private.can_accept_invitation(organization_id, user_id)
    )
  )
  WITH CHECK (
    organization_id = app_private.current_organization_id()
    AND app_private.has_organization_lock(organization_id)
    AND (
      app_private.can_manage_membership(organization_id, user_id, role)
      OR app_private.can_activate_membership(organization_id, user_id, role)
    )
  );--> statement-breakpoint

CREATE POLICY invitations_recipient_or_member_select ON public.organization_invitations
  FOR SELECT TO arcsyn_shift_runtime
  USING (invited_user_id = app_private.current_user_id());--> statement-breakpoint
CREATE POLICY invitations_authorized_insert ON public.organization_invitations
  FOR INSERT TO arcsyn_shift_runtime
  WITH CHECK (
    organization_id = app_private.current_organization_id()
    AND invited_by = app_private.current_user_id()
    AND app_private.can_invite(organization_id, role)
  );--> statement-breakpoint
CREATE POLICY invitations_recipient_update ON public.organization_invitations
  FOR UPDATE TO arcsyn_shift_runtime
  USING (
    invited_user_id = app_private.current_user_id()
    AND organization_id = app_private.current_organization_id()
    AND app_private.has_organization_lock(organization_id)
    AND status = 'pending'
  )
  WITH CHECK (
    invited_user_id = app_private.current_user_id()
    AND app_private.has_organization_lock(organization_id)
    AND status = 'accepted'
    AND accepted_at IS NOT NULL
    AND cancelled_at IS NULL
  );--> statement-breakpoint
CREATE POLICY invitations_manager_cancel ON public.organization_invitations
  FOR UPDATE TO arcsyn_shift_runtime
  USING (
    organization_id = app_private.current_organization_id()
    AND app_private.has_organization_lock(organization_id)
    AND status = 'pending'
    AND app_private.can_invite(organization_id, role)
  )
  WITH CHECK (
    organization_id = app_private.current_organization_id()
    AND app_private.has_organization_lock(organization_id)
    AND status = 'cancelled'
    AND cancelled_at IS NOT NULL
    AND accepted_at IS NULL
  );--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO arcsyn_shift_runtime;--> statement-breakpoint
GRANT SELECT, INSERT ON public.organizations TO arcsyn_shift_runtime;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON public.organization_memberships TO arcsyn_shift_runtime;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON public.organization_invitations TO arcsyn_shift_runtime;--> statement-breakpoint

CREATE FUNCTION app_private.ensure_organization_has_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF OLD.status = 'active' AND OLD.role = 'owner'
    AND (NEW.status <> 'active' OR NEW.role <> 'owner')
  THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(OLD.organization_id::text, 0));

    IF NOT EXISTS (
        SELECT 1
        FROM public.organization_memberships membership
        WHERE membership.organization_id = OLD.organization_id
          AND membership.user_id <> OLD.user_id
          AND membership.status = 'active'
          AND membership.role = 'owner'
      )
    THEN
      RAISE EXCEPTION 'organization must retain an owner' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
ALTER FUNCTION app_private.ensure_organization_has_owner() OWNER TO arcsyn_shift_rls;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_private.ensure_organization_has_owner() FROM PUBLIC;--> statement-breakpoint
CREATE TRIGGER organization_memberships_owner_guard
  BEFORE UPDATE ON public.organization_memberships
  FOR EACH ROW EXECUTE FUNCTION app_private.ensure_organization_has_owner();--> statement-breakpoint

CREATE FUNCTION app_private.enforce_invitation_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(OLD.organization_id::text, 0));

  IF NEW.id <> OLD.id
    OR NEW.organization_id <> OLD.organization_id
    OR NEW.invited_user_id <> OLD.invited_user_id
    OR NEW.role <> OLD.role
    OR NEW.invited_by <> OLD.invited_by
    OR NEW.expires_at <> OLD.expires_at
    OR NEW.created_at <> OLD.created_at
  THEN
    RAISE EXCEPTION 'invitation identity is immutable' USING ERRCODE = '23514';
  END IF;

  IF OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'invitation is not pending' USING ERRCODE = '23514';
  END IF;

  IF app_private.current_user_id() = OLD.invited_user_id THEN
    IF NEW.status <> 'accepted' OR NEW.accepted_at IS NULL OR NEW.cancelled_at IS NOT NULL THEN
      RAISE EXCEPTION 'invalid invitation acceptance' USING ERRCODE = '23514';
    END IF;
  ELSIF app_private.can_invite(OLD.organization_id, OLD.role) THEN
    IF NEW.status <> 'cancelled' OR NEW.cancelled_at IS NULL OR NEW.accepted_at IS NOT NULL THEN
      RAISE EXCEPTION 'invalid invitation cancellation' USING ERRCODE = '23514';
    END IF;
  ELSE
    RAISE EXCEPTION 'invitation transition is forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_private.enforce_invitation_transition() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_private.enforce_invitation_transition() TO arcsyn_shift_runtime;--> statement-breakpoint
CREATE TRIGGER organization_invitations_transition_guard
  BEFORE UPDATE ON public.organization_invitations
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_invitation_transition();--> statement-breakpoint

CREATE FUNCTION app_private.prevent_organization_slug_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF NEW.slug <> OLD.slug THEN
    RAISE EXCEPTION 'organization slug is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_private.prevent_organization_slug_update() FROM PUBLIC;--> statement-breakpoint
CREATE TRIGGER organizations_slug_immutable
  BEFORE UPDATE OF slug ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION app_private.prevent_organization_slug_update();--> statement-breakpoint
REVOKE CREATE ON SCHEMA app_private FROM arcsyn_shift_rls;
