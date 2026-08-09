# Plano: Organizations, RBAC e RLS

## Etapas

1. Registrar a decisão arquitetural de tenancy e RLS.
2. Definir schemas compartilhados para organizações, membros e convites.
3. Criar schema Drizzle e migração revisável com constraints, índices, role de
   runtime, helpers e políticas RLS.
4. Criar módulo `organizations` na API, autenticação BFF reutilizável, RBAC e
   transações com contexto local.
5. Criar feature web para organizações, home, convites e rota por slug.
6. Adicionar testes de contratos, domínio, autorização, RLS, navegação e UX.
7. Executar verificações completas do monorepo e revisar o SQL gerado.
8. Centralizar o tratamento de erros na apresentação HTTP e no dispatcher MCP,
   mantendo a tradução fora da transação e sem habilitar tools de organizations.

## Fronteiras

- `packages/contracts`: formatos públicos e validação runtime;
- `packages/database`: schema, conexão com contexto e migração;
- `apps/api/src/modules/organizations`: regras e transportes da capacidade;
- `apps/web/src/features/organizations`: HTTP, queries e componentes;
- `apps/web/src/pages`: composição da home e ambiente da organização.

Nenhuma role organizacional será incluída em token. Nenhum cliente escolherá um
`user_id` ou `organization_id` autoritativo sem validação server-side.
