DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'arcsyn_shift_application') THEN
    CREATE ROLE arcsyn_shift_application LOGIN PASSWORD 'arcsyn_shift_application'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'arcsyn_shift_provisioning') THEN
    CREATE ROLE arcsyn_shift_provisioning LOGIN PASSWORD 'arcsyn_shift_provisioning'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'arcsyn_shift_migration') THEN
    CREATE ROLE arcsyn_shift_migration LOGIN PASSWORD 'arcsyn_shift_migration' NOSUPERUSER NOBYPASSRLS;
  END IF;
END
$$;

ALTER ROLE arcsyn_shift_migration WITH PASSWORD 'arcsyn_shift_migration';
ALTER ROLE arcsyn_shift_application WITH PASSWORD 'arcsyn_shift_application'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
ALTER ROLE arcsyn_shift_provisioning WITH PASSWORD 'arcsyn_shift_provisioning'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;

GRANT CONNECT ON DATABASE arcsyn_shift TO arcsyn_shift_application;
GRANT CONNECT ON DATABASE arcsyn_shift TO arcsyn_shift_provisioning;
GRANT CONNECT ON DATABASE arcsyn_shift TO arcsyn_shift_migration;
GRANT USAGE ON SCHEMA public TO arcsyn_shift_application;
GRANT USAGE ON SCHEMA public TO arcsyn_shift_provisioning;

-- Grants de tabelas sao aplicados explicitamente depois das migracoes por
-- infra/postgres/access/01-auth-roles.sql. Nenhuma role de runtime ou
-- provisionamento deve herdar acesso a tabelas futuras.
ALTER DEFAULT PRIVILEGES FOR ROLE arcsyn_shift_migration IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM arcsyn_shift_application;
ALTER DEFAULT PRIVILEGES FOR ROLE arcsyn_shift_migration IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM arcsyn_shift_application;
ALTER DEFAULT PRIVILEGES FOR ROLE arcsyn_shift_migration IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM arcsyn_shift_provisioning;
ALTER DEFAULT PRIVILEGES FOR ROLE arcsyn_shift_migration IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM arcsyn_shift_provisioning;
