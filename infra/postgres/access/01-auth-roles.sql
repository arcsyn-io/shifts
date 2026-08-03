BEGIN;

DO $$
BEGIN
  IF to_regclass('public.system_health') IS NULL
    OR to_regclass('public.users') IS NULL
    OR to_regclass('public.auth_refresh_token_families') IS NULL
    OR to_regclass('public.auth_refresh_tokens') IS NULL
    OR to_regclass('public.auth_rate_limits') IS NULL THEN
    RAISE EXCEPTION 'Execute todas as migracoes antes de aplicar os grants de acesso';
  END IF;
END
$$;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public
  FROM arcsyn_shift_application, arcsyn_shift_provisioning;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public
  FROM arcsyn_shift_application, arcsyn_shift_provisioning;
REVOKE CREATE ON SCHEMA public
  FROM arcsyn_shift_application, arcsyn_shift_provisioning;
GRANT USAGE ON SCHEMA public
  TO arcsyn_shift_application, arcsyn_shift_provisioning;

GRANT SELECT ON TABLE public.system_health TO arcsyn_shift_application;
GRANT SELECT ON TABLE public.users TO arcsyn_shift_application;
GRANT SELECT, INSERT, UPDATE ON TABLE public.auth_refresh_token_families
  TO arcsyn_shift_application;
GRANT SELECT, INSERT, UPDATE ON TABLE public.auth_refresh_tokens
  TO arcsyn_shift_application;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.auth_rate_limits
  TO arcsyn_shift_application;

GRANT SELECT (id, email), INSERT (email, password_hash),
  UPDATE (email, password_hash, is_active, updated_at)
  ON TABLE public.users TO arcsyn_shift_provisioning;

COMMIT;
