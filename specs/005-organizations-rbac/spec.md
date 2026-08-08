# Especificação: Organizations, convites, RBAC e isolamento por RLS

**Status:** Aprovada

**Data:** 2026-08-08

## Objetivo

Permitir que usuários autenticados criem e acessem organizações, sejam
convidados para organizações existentes e operem dentro delas conforme um papel
RBAC próprio daquele vínculo. Dados específicos de organização devem permanecer
isolados tanto pela aplicação quanto por Row-Level Security no PostgreSQL.

## Escopo

- criar organização com slug global, único e imutável;
- tornar o criador o primeiro `owner` na mesma transação;
- listar na home as organizações acessíveis e os convites pendentes;
- convidar contas já existentes, sem envio de email neste MVP;
- aceitar convite e ativar acesso de forma atômica e idempotente;
- acessar diretamente `/organizations/:slug`, inclusive após autenticação;
- listar membros, alterar seus papéis e revogar acessos conforme RBAC;
- aplicar RLS default-deny aos dados próprios de organizações.

Ficam fora do escopo: cadastro disparado por convite, envio de email, papéis
customizáveis, renomeação de slug, auto-saída, exclusão de organização,
autorização MCP e associação de `system_health` a uma organização.

## Modelo de autorização

Os papéis pertencem ao vínculo entre usuário e organização e nunca ao usuário
globalmente ou ao JWT.

| Ação                       | `owner` | `admin` | `member` |
| -------------------------- | ------- | ------- | -------- |
| Acessar a organização      | sim     | sim     | sim      |
| Listar membros             | sim     | sim     | sim      |
| Convidar `member`          | sim     | sim     | não      |
| Convidar `admin`           | sim     | não     | não      |
| Convidar `owner`           | sim     | não     | não      |
| Alterar qualquer papel     | sim     | não     | não      |
| Revogar `member`           | sim     | sim     | não      |
| Revogar `admin` ou `owner` | sim     | não     | não      |

Um `admin` não pode alterar papéis nem revogar a si próprio. Um `owner` pode
transferir ownership promovendo outro membro, mas a organização deve manter ao
menos um `owner`; o último owner não pode ser rebaixado nem revogado.

## Requisitos funcionais

- **FR-001:** uma organização possui UUID estável, nome, slug, timestamps e
  estado ativo.
- **FR-002:** um usuário pode participar de várias organizações com papéis
  independentes.
- **FR-003:** criação da organização e vínculo do primeiro owner são atômicos.
- **FR-004:** a home lista somente organizações com vínculo ativo do usuário.
- **FR-005:** convite registra organização, destinatário existente, papel,
  emissor, validade, status e timestamps.
- **FR-005a:** a aplicação mantém um diretório mínimo, provisionado a partir de
  sessões Supabase válidas, para resolver contas existentes sem `service_role`.
- **FR-006:** somente o destinatário autenticado pode consultar e aceitar seu
  convite.
- **FR-007:** aceite consome o convite e cria ou reativa o vínculo uma única
  vez.
- **FR-008:** convite expirado, cancelado, aceito ou destinado a outra
  identidade não concede acesso.
- **FR-008a:** convites expiram após sete dias; convite pendente duplicado
  retorna conflito e revogação cancela convites pendentes do destinatário na
  mesma transação.
- **FR-009:** vínculo ou permissão não comprovados resultam em negação por
  padrão.
- **FR-010:** revogação produz efeito na requisição seguinte, mesmo que a sessão
  Supabase continue válida.
- **FR-011:** não existe endpoint de auto-saída neste MVP.
- **FR-012:** todo dado tenant-specific possui `organization_id` obrigatório e
  toda operação recebe contexto organizacional explícito.
- **FR-013:** organização inexistente e organização inacessível não revelam
  informações que permitam enumeração.
- **FR-014:** acesso direto restaura a sessão e preserva um destino interno
  seguro no redirecionamento para login.

## Requisitos não funcionais

- a conexão de runtime usa role `NOBYPASSRLS`, sem ownership das tabelas;
- o owner das tabelas e a credencial de migração não são usados pela aplicação;
- tabelas tenant-specific usam `ENABLE` e `FORCE ROW LEVEL SECURITY`;
- principal e organização são definidos localmente dentro de cada transação;
- contexto não pode vazar entre conexões reutilizadas pelo pool;
- RBAC é validado na aplicação e RLS atua como segunda camada;
- logs não incluem tokens, conteúdo sensível de convite nem email completo;
- respostas distinguem autenticação, autorização, validação e indisponibilidade;
- frontend oferece estados de loading, vazio, erro e acesso negado, mobile first
  e acessível por teclado.

## Critérios de aceite

- **AC-001:** falha durante criação não deixa organização ou membership parcial.
- **AC-002:** usuário de A não acessa dados de B por API, slug alterado no
  request ou consulta sem filtro explícito.
- **AC-003:** aceite concorrente cria no máximo um membership ativo.
- **AC-004:** outro usuário não consulta nem aceita convite alheio.
- **AC-005:** member não convida, altera papéis ou revoga.
- **AC-006:** admin convida e revoga member, mas não administra admin/owner.
- **AC-007:** último owner não pode ser revogado ou rebaixado.
- **AC-008:** usuário revogado perde acesso na próxima requisição e por URL
  direta.
- **AC-009:** RLS continua isolando uma consulta tenant-specific sem predicado
  de organização na camada de repositório.
- **AC-010:** gate de segurança falha se a conexão de runtime tiver `BYPASSRLS`,
  superuser ou ownership das tabelas protegidas.
- **AC-011:** usuário anônimo que abre URL organizacional retorna ao mesmo
  destino depois do login.
- **AC-012:** slug inválido, inexistente e inacessível não expõem dados da
  organização.
- **AC-013:** a home representa separadamente organizações, convites pendentes,
  estados vazios, falha e retry.

## Contratos HTTP

- `GET /api/organizations`
- `POST /api/organizations`
- `GET /api/organizations/:slug`
- `GET /api/organizations/:slug/members`
- `PATCH /api/organizations/:slug/members/:userId`
- `DELETE /api/organizations/:slug/members/:userId`
- `POST /api/organizations/:slug/invitations`
- `GET /api/organization-invitations`
- `POST /api/organization-invitations/:invitationId/accept`

A criação de convite retorna `201` com o convite, o aceite retorna `200` com a
organização acessível e uma duplicata pendente retorna `409`.

Mutações exigem sessão BFF, origem confiável e `application/json` quando houver
body. IDs, slugs, emails e payloads são validados pelos schemas compartilhados.

## Riscos

- conexão privilegiada contornar RLS;
- `SECURITY DEFINER` recursivo ou com `search_path` inseguro;
- contexto de usuário/organização permanecer na conexão do pool;
- corrida entre aceite, mudança de papel e revogação;
- enumeração por slug, UUID ou email;
- cache frontend preservar acesso revogado;
- último owner ser removido por operações concorrentes.
