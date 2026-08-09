-- Credenciais exclusivamente locais. Produção deve provisionar um login forte
-- no secret store do provedor e conceder somente arcsyn_shift_runtime.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arcsyn_shift_runtime') THEN
    CREATE ROLE arcsyn_shift_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arcsyn_shift_app_local') THEN
    CREATE ROLE arcsyn_shift_app_local LOGIN PASSWORD 'arcsyn_shift_local'
      NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOBYPASSRLS;
  END IF;
END
$$;

GRANT arcsyn_shift_runtime TO arcsyn_shift_app_local;
GRANT arcsyn_shift_runtime TO CURRENT_USER WITH SET TRUE;
