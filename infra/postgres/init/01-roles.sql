DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'arcsyn_shift_application') THEN
    CREATE ROLE arcsyn_shift_application LOGIN PASSWORD 'arcsyn_shift_application' NOSUPERUSER NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'arcsyn_shift_migration') THEN
    CREATE ROLE arcsyn_shift_migration LOGIN PASSWORD 'arcsyn_shift_migration' NOSUPERUSER NOBYPASSRLS;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE arcsyn_shift TO arcsyn_shift_application;
GRANT CONNECT ON DATABASE arcsyn_shift TO arcsyn_shift_migration;
GRANT USAGE ON SCHEMA public TO arcsyn_shift_application;
ALTER DEFAULT PRIVILEGES FOR ROLE arcsyn_shift_migration IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO arcsyn_shift_application;
ALTER DEFAULT PRIVILEGES FOR ROLE arcsyn_shift_migration IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO arcsyn_shift_application;
