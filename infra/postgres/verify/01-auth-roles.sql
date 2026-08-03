DO $$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'arcsyn_shift_application',
    'arcsyn_shift_provisioning'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_roles
      WHERE rolname = role_name
        AND NOT rolsuper
        AND NOT rolcreatedb
        AND NOT rolcreaterole
        AND NOT rolinherit
        AND NOT rolreplication
        AND NOT rolbypassrls
    ) THEN
      RAISE EXCEPTION 'Role % ausente ou com atributos excessivos', role_name;
    END IF;

    IF has_schema_privilege(role_name, 'public', 'CREATE') THEN
      RAISE EXCEPTION 'Role % nao pode criar objetos no schema public', role_name;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_default_acl AS default_acl
    JOIN pg_catalog.pg_roles AS owner_role
      ON owner_role.oid = default_acl.defaclrole
    CROSS JOIN LATERAL aclexplode(default_acl.defaclacl) AS privilege
    JOIN pg_catalog.pg_roles AS grantee_role
      ON grantee_role.oid = privilege.grantee
    WHERE owner_role.rolname = 'arcsyn_shift_migration'
      AND grantee_role.rolname IN (
        'arcsyn_shift_application',
        'arcsyn_shift_provisioning'
      )
  ) THEN
    RAISE EXCEPTION 'Roles operacionais nao podem receber default privileges';
  END IF;

  IF NOT has_table_privilege('arcsyn_shift_application', 'public.users', 'SELECT')
    OR has_table_privilege('arcsyn_shift_application', 'public.users', 'INSERT')
    OR has_table_privilege('arcsyn_shift_application', 'public.users', 'UPDATE')
    OR has_table_privilege('arcsyn_shift_application', 'public.users', 'DELETE') THEN
    RAISE EXCEPTION 'Role runtime possui privilegios incorretos em users';
  END IF;

  IF NOT has_table_privilege('arcsyn_shift_application', 'public.auth_refresh_token_families', 'SELECT, INSERT, UPDATE')
    OR has_table_privilege('arcsyn_shift_application', 'public.auth_refresh_token_families', 'DELETE')
    OR NOT has_table_privilege('arcsyn_shift_application', 'public.auth_refresh_tokens', 'SELECT, INSERT, UPDATE')
    OR has_table_privilege('arcsyn_shift_application', 'public.auth_refresh_tokens', 'DELETE')
    OR NOT has_table_privilege('arcsyn_shift_application', 'public.auth_rate_limits', 'SELECT, INSERT, UPDATE, DELETE') THEN
    RAISE EXCEPTION 'Role runtime nao possui os privilegios minimos dos fluxos de auth';
  END IF;

  IF NOT has_column_privilege('arcsyn_shift_provisioning', 'public.users', 'id', 'SELECT')
    OR NOT has_column_privilege('arcsyn_shift_provisioning', 'public.users', 'email', 'SELECT, INSERT, UPDATE')
    OR NOT has_column_privilege('arcsyn_shift_provisioning', 'public.users', 'password_hash', 'INSERT, UPDATE')
    OR NOT has_column_privilege('arcsyn_shift_provisioning', 'public.users', 'is_active', 'UPDATE')
    OR has_column_privilege('arcsyn_shift_provisioning', 'public.users', 'password_hash', 'SELECT')
    OR has_column_privilege('arcsyn_shift_provisioning', 'public.users', 'id', 'UPDATE')
    OR has_table_privilege('arcsyn_shift_provisioning', 'public.users', 'DELETE')
    OR has_table_privilege('arcsyn_shift_provisioning', 'public.auth_refresh_token_families', 'SELECT')
    OR has_table_privilege('arcsyn_shift_provisioning', 'public.auth_refresh_tokens', 'SELECT')
    OR has_table_privilege('arcsyn_shift_provisioning', 'public.auth_rate_limits', 'SELECT') THEN
    RAISE EXCEPTION 'Role de provisionamento possui privilegios incorretos';
  END IF;
END
$$;

SELECT 'roles de auth validadas' AS resultado;
