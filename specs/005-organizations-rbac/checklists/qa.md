# Plano e checklist de QA: Organizations, RBAC e RLS

**Status:** implementado e validado

**Data:** 2026-08-08

**Especificação:** `specs/005-organizations-rbac/spec.md`

**Plano:** `specs/005-organizations-rbac/plan.md`

**ADR relacionada:**
`docs/architecture/decisions/0004-tenancy-organizations-rbac-rls.md` **Revisão
de segurança:** `docs/security/organizations-rbac-rls.md`

## 1. Resumo de qualidade

A arquitetura é testável nos fluxos essenciais e possui critérios objetivos para
isolamento, RBAC, atomicidade, revogação e navegação. A aprovação de qualidade
deve ser bloqueada se qualquer cenário P0 de isolamento, privilégio da conexão,
último `owner`, aceite concorrente ou retorno pós-login falhar.

Este documento começou como matriz pré-implementação. Ao final, contracts,
database, API e web foram implementados; as evidências executadas estão
registradas nesta checklist e na revisão de segurança relacionada.

## 2. Escopo e riscos considerados

### Dentro do escopo

- relação N:N entre usuários e organizações, com papel por membership;
- criação atômica de organização e primeiro `owner`;
- convites somente para contas existentes, sem envio de email;
- aceite idempotente, expiração, cancelamento e identidade destinatária;
- matriz `owner`/`admin`/`member`, revogação e ausência de auto-saída;
- slug global, case-insensitive, único e imutável;
- preservação de ao menos um `owner` e transferência de ownership;
- isolamento pela aplicação e por RLS default-deny;
- role de runtime `NOBYPASSRLS`, sem superuser ou ownership;
- isolamento do contexto transacional ao reutilizar conexões do pool;
- home com organizações, convites e estados de interface;
- rota `/organizations/:slug` e preservação do destino após login;
- acessibilidade, responsividade, privacidade e observabilidade previstas na
  especificação.

Decisões confirmadas pelo agente principal: o destinatário é localizado por
email normalizado; email é PII e não há entrega externa no MVP. Convite dura 7
dias. Criação retorna `201`, aceite retorna `200` e convite pendente duplicado
retorna `409`. Depois de autorizar o ator, email inexistente ou destinatário
indisponível retorna o mesmo `404 ORGANIZATION_USER_NOT_FOUND`, sem email
completo em resposta ou log. Não existe busca pública de contas.

### Fora do escopo

- envio de email e cadastro disparado por convite;
- papéis customizados, exclusão de organização ou alteração de slug;
- auto-saída, autorização MCP e tenancy de `system_health`;
- decisões de produção do Supabase que não sejam necessárias para validar a role
  PostgreSQL da aplicação.

### Riscos prioritários

- **R-001:** leitura ou mutação cross-tenant por filtro ausente, slug adulterado
  ou contexto vazado no pool;
- **R-002:** runtime privilegiado contornar RLS;
- **R-003:** remoção concorrente do último `owner`;
- **R-004:** aceite concorrente criar memberships duplicados ou inconsistentes;
- **R-005:** autorização baseada em papel obsoleto ou fornecido pelo cliente;
- **R-006:** revogação não ter efeito por cache ou sessão ainda válida;
- **R-007:** enumeração de organização, convite ou conta por respostas
  distintas;
- **R-008:** URL organizacional se perder ou permitir open redirect;
- **R-009:** interface esconder estados de falha, acesso negado ou convites;
- **R-010:** logs exporem email completo ou conteúdo sensível de convite.

## 3. Lacunas e ambiguidades dos requisitos

Os itens abaixo precisam ser resolvidos pelo agente principal com o
`requirements_architect` antes de estabilizar contratos e asserções. Eles não
impedem a implementação dos controles P0 que já estão claros.

1. O status `cancelado` é citado, mas não há contrato HTTP para cancelar convite
   nem matriz dizendo quem pode fazê-lo.
2. Não está definido como convidar alguém que já possui membership ativo ou
   revogado, além da indicação de que o aceite pode reativar um vínculo.
3. Os status HTTP, códigos de erro e corpos necessários para tornar organização
   inexistente e inacessível indistinguíveis ainda não estão especificados.
4. A gramática, normalização Unicode e limites de tamanho de nome e slug não
   estão definidos. Apenas unicidade global case-insensitive e imutabilidade
   estão decididas.
5. “Transferir ownership” está descrito como promover outro membro. Não há
   operação dedicada nem decisão de rebaixar automaticamente o `owner` atual. Os
   testes assumem somente promoção seguida, se desejado, de outra alteração
   explícita, sempre preservando ao menos um `owner`.
6. O conjunto exato de tabelas tenant-specific protegidas na primeira entrega
   precisa constar do plano de migração para que nenhuma fique fora do gate RLS.
7. Ordenação, paginação e limites das listas de organizações, membros e convites
   não possuem resultado esperado.
8. O comportamento da organização com estado inativo não está definido, embora
   `FR-001` exija estado ativo no modelo.
9. Não há meta quantitativa de desempenho ou volume. Testes de carga ficam
   condicionados à definição de SLO e cardinalidade esperada.
10. Não foi definida a ordem vencedora entre aceite e revogação/cancelamento
    concorrentes, nem se revogar membership cancela convites pendentes antigos.

## 4. Matriz de rastreabilidade

| Requisito                                | Critério                | Risco                         | Cenário                | Nível recomendado      | Evidência      |
| ---------------------------------------- | ----------------------- | ----------------------------- | ---------------------- | ---------------------- | -------------- |
| FR-001, FR-003                           | AC-001                  | parcialidade na criação       | TC-001                 | integração             | não disponível |
| FR-002, FR-004                           | AC-002, AC-013          | papel global ou lista cruzada | TC-002, TC-021         | integração, componente | não disponível |
| FR-009, FR-012, FR-013                   | AC-002, AC-009, AC-012  | R-001, R-007                  | TC-003, TC-004, TC-024 | integração, E2E        | não disponível |
| NFR: runtime `NOBYPASSRLS` e `FORCE RLS` | AC-010                  | R-002                         | TC-005                 | integração             | não disponível |
| NFR: contexto local à transação          | AC-002, AC-009          | R-001                         | TC-006                 | integração             | não disponível |
| matriz de autorização                    | AC-005, AC-006          | R-005                         | TC-007, TC-008, TC-009 | unitário, integração   | não disponível |
| último `owner` e transferência           | AC-007                  | R-003                         | TC-010, TC-011         | integração concorrente | não disponível |
| FR-005                                   | matriz de autorização   | R-007, R-010                  | TC-012, TC-013         | integração, contrato   | não disponível |
| FR-006, FR-008                           | AC-004                  | convite alheio ou inválido    | TC-014                 | integração             | não disponível |
| FR-007                                   | AC-003                  | R-004                         | TC-015, TC-016         | integração concorrente | não disponível |
| FR-010                                   | AC-008                  | R-005, R-006                  | TC-017                 | integração, E2E        | não disponível |
| FR-011                                   | escopo aprovado         | auto-saída indevida           | TC-018                 | contrato, integração   | não disponível |
| slug global, único e imutável            | AC-012                  | colisão, enumeração           | TC-019                 | integração, contrato   | não disponível |
| contratos HTTP e fronteira BFF           | AC-012                  | entrada inválida, CSRF        | TC-020                 | contrato               | não disponível |
| FR-004 e home                            | AC-013                  | R-006, R-009                  | TC-021, TC-022         | componente             | não disponível |
| FR-014                                   | AC-011                  | R-008                         | TC-023                 | unitário, E2E          | E-002, E-003   |
| acesso direto organizacional             | AC-008, AC-012          | R-006, R-007                  | TC-024                 | componente, E2E        | não disponível |
| FR-012                                   | AC-009                  | dado órfão ou sem tenant      | TC-025                 | integração             | não disponível |
| NFR: logs sem conteúdo sensível          | requisito não funcional | R-010                         | TC-026                 | integração             | não disponível |

### Evidências de baseline

- **E-001:** a inspeção inicial em 2026-08-08 não encontrou implementação. Um
  diff parcial de contracts, schema e migração surgiu durante o planejamento e
  foi revisado apenas estaticamente; isso não aprova comportamento.
- **E-002:** `AppRouter.tsx` protege somente `/`, e `redirect.ts` reconhece
  somente `/` como destino protegido. A rota por slug ainda precisará entrar na
  allowlist segura.
- **E-003:** os testes atuais de redirect cobrem query/hash na raiz e rejeição
  de destinos externos, mas ainda não cobrem `/organizations/:slug`.
- **E-004:** `pnpm --filter @arcsyn-shift/web test -- auth-redirect.test.ts`
  concluiu com 1 arquivo e 7 testes aprovados em 2026-08-08. É evidência somente
  do baseline de redirect existente.
- **E-005:** `pnpm --filter @arcsyn-shift/contracts test` concluiu com 2
  arquivos e 11 testes aprovados, incluindo 8 casos do contrato parcial de
  organizations.
- **E-006:** `pnpm --filter @arcsyn-shift/database test` concluiu novamente com
  2 arquivos e 6 testes aprovados. Os 4 casos de RLS inspecionam texto da
  migration e o teste de contexto usa mock; nenhum executa PostgreSQL. Portanto,
  não são evidência de RLS, grants, ownership, corrida ou isolamento do pool.

## 5. Cenários priorizados

### TC-001 — Criar organização e primeiro owner atomicamente

- **Objetivo:** comprovar que organização e membership inicial formam uma única
  unidade transacional.
- **Relações:** FR-001, FR-003; AC-001; R-003.
- **Prioridade:** P0.
- **Nível:** integração com PostgreSQL real.
- **Pré-condições:** usuário autenticado existente; schema e migração aplicados;
  role de runtime ativa.
- **Dados:** usuário `user-owner-a`; nome `Operação Norte`; slug
  `operacao-norte`.
- **Dado/Quando/Então:** dado um usuário sem essa organização, quando a criação
  conclui, então uma organização ativa e exatamente um membership `owner` do
  criador existem. Quando uma falha é injetada antes ou depois do insert de
  membership, então toda a transação é revertida.
- **Resultado esperado:** sucesso retorna `201`; nunca existe organização sem
  primeiro `owner`, nem membership apontando para organização ausente.
- **Variações e limites:** timeout, violação de slug, falha após o primeiro
  insert e repetição do request.
- **Automação sugerida:** sim,
  `packages/database/test/organizations.creation.integration.test.ts` e caso de
  uso em `apps/api/test/organizations.use-cases.test.ts`.

### TC-002 — Manter memberships e papéis independentes entre organizações

- **Objetivo:** comprovar a relação N:N sem papel global.
- **Relações:** FR-002, FR-004; AC-002; R-005.
- **Prioridade:** P1.
- **Nível:** integração.
- **Pré-condições:** organizações A e B ativas.
- **Dados:** usuário U como `owner` em A e `member` em B; usuário V somente em
  B.
- **Dado/Quando/Então:** dado U com dois vínculos, quando consulta cada
  organização, então seu papel e permissões correspondem ao membership daquela
  organização. Quando consulta a home, então A e B aparecem para U, e somente B
  aparece para V.
- **Resultado esperado:** alterar o papel em A não muda o papel ou acesso em B.
- **Variações e limites:** vínculo revogado em uma organização e ativo em outra;
  memberships criados em ordens diferentes.
- **Automação sugerida:** sim,
  `apps/api/test/organizations.authorization.integration.test.ts`.

### TC-003 — Negar acesso cross-tenant e evitar enumeração

- **Objetivo:** impedir leitura e mutação de B por usuário restrito a A.
- **Relações:** FR-009, FR-013; AC-002, AC-012; R-001, R-007.
- **Prioridade:** P0.
- **Nível:** integração HTTP.
- **Pré-condições:** sessão válida de U, com acesso apenas a A; B possui membros
  e convites que U não pode consultar.
- **Dados:** slugs `org-a`, `org-b` e `org-inexistente`; UUIDs sintéticos.
- **Dado/Quando/Então:** dado U, quando troca o slug de A para B em cada
  endpoint organizacional, então nenhum dado ou efeito de B é retornado. Quando
  repete com slug inexistente, então status, código e corpo públicos não
  permitem distinguir B de algo inexistente.
- **Resultado esperado:** zero vazamento de nome, UUID, membros, papéis,
  convites ou existência da organização; nenhuma mutação é persistida.
- **Variações e limites:** caixa diferente, slug codificado, UUID de membro de B
  sob slug de A e tempos de resposta materialmente distintos.
- **Automação sugerida:** sim,
  `apps/api/test/organizations.http.integration.test.ts`; fixar a equivalência
  exata após o contrato de erro ser aprovado.

### TC-004 — RLS isolar consulta sem predicado de organização

- **Objetivo:** provar a defesa em profundidade quando o repositório omite o
  filtro tenant.
- **Relações:** FR-009, FR-012; AC-002, AC-009; R-001.
- **Prioridade:** P0.
- **Nível:** integração direta com PostgreSQL.
- **Pré-condições:** tabelas tenant-specific com `ENABLE` e
  `FORCE ROW LEVEL SECURITY`; transação com principal e organização A.
- **Dados:** linhas equivalentes em A e B, inclusive mesmo nome externo.
- **Dado/Quando/Então:** dado contexto válido de A, quando a role de runtime
  executa `SELECT`, `UPDATE` ou `DELETE` sem `WHERE organization_id`, então vê
  ou altera somente A. Dado contexto ausente, inválido ou parcial, então a mesma
  operação falha fechada e não retorna linhas.
- **Resultado esperado:** B permanece invisível e inalterada em todos os verbos
  protegidos.
- **Variações e limites:** `INSERT` com `organization_id` de B, contexto de
  usuário sem membership e organização válida com principal vazio.
- **Automação sugerida:** sim,
  `packages/database/test/organizations.rls.integration.test.ts`.

### TC-005 — Bloquear runtime privilegiado e helpers RLS inseguros

- **Objetivo:** transformar a postura da role de runtime em gate executável.
- **Relações:** NFR de role, ownership e helpers; AC-010; R-002.
- **Prioridade:** P0.
- **Nível:** integração de banco e inspeção da migração.
- **Pré-condições:** migração aplicada em banco isolado; URLs de runtime e
  migração separadas.
- **Dados:** nomes reais das roles e de todas as tabelas protegidas.
- **Dado/Quando/Então:** dado login com a role de runtime, quando são
  consultados `pg_roles`, ownership, grants e flags de RLS, então a role é
  `NOSUPERUSER`, `NOBYPASSRLS`, não é owner e não pode desabilitar RLS ou
  executar DDL. Quando houver helper `SECURITY DEFINER`, então seu owner,
  `search_path` e grants são mínimos e explícitos.
- **Resultado esperado:** o gate falha para qualquer tabela tenant-specific sem
  `ENABLE` + `FORCE RLS` ou qualquer privilégio proibido.
- **Variações e limites:** runtime herdando privilégio por role-grant e `PUBLIC`
  com `EXECUTE` em helper.
- **Automação sugerida:** sim,
  `packages/database/test/runtime-role.security.integration.test.ts`.

### TC-006 — Não vazar contexto ao reutilizar conexão do pool

- **Objetivo:** provar que principal e organização valem somente na transação.
- **Relações:** NFR de contexto local; AC-002, AC-009; R-001.
- **Prioridade:** P0.
- **Nível:** integração concorrente com pool real.
- **Pré-condições:** pool pequeno, idealmente uma conexão, e helpers de contexto
  disponíveis.
- **Dados:** requisição 1 para U/A e requisição 2 para V/B.
- **Dado/Quando/Então:** dado que a mesma conexão física atende U/A, quando ela
  volta ao pool e é reutilizada por V/B ou por operação sem contexto, então a
  segunda transação não observa A nem U. Em requests paralelos, cada um observa
  apenas seu próprio tenant.
- **Resultado esperado:** configuração volta ao estado seguro após commit,
  rollback, exceção e cancelamento.
- **Variações e limites:** commit, rollback, timeout e erro entre a definição do
  principal e da organização.
- **Automação sugerida:** sim,
  `packages/database/test/organization-context.integration.test.ts`.

### TC-007 — Aplicar permissões de owner

- **Objetivo:** comprovar todas as ações permitidas ao `owner` sem violar o
  último owner.
- **Relações:** matriz de autorização; AC-007; R-003, R-005.
- **Prioridade:** P1.
- **Nível:** unitário para a matriz e integração para efeitos persistentes.
- **Pré-condições:** organização com dois owners, um admin e um member.
- **Dados:** convites para `owner`, `admin` e `member`; alterações entre os três
  papéis.
- **Dado/Quando/Então:** dado um owner atual, quando lista membros, convida cada
  papel, altera papéis e revoga member/admin/owner não final, então cada ação é
  autorizada e persiste somente na organização em contexto.
- **Resultado esperado:** a matriz aprovada é atendida, com estado atual do
  banco como fonte de autorização.
- **Variações e limites:** alvo já revogado, convite já consumido e ação sobre
  membro de outra organização.
- **Automação sugerida:** sim, `apps/api/test/organizations.rbac.test.ts` e
  integração HTTP correspondente.

### TC-008 — Limitar admin a convidar e revogar member

- **Objetivo:** comprovar permissões positivas e negativas de `admin`.
- **Relações:** matriz de autorização; AC-006; R-005.
- **Prioridade:** P0.
- **Nível:** unitário e integração HTTP.
- **Pré-condições:** admin, member, outro admin e owner na mesma organização.
- **Dados:** convites com papéis `member`, `admin`, `owner`.
- **Dado/Quando/Então:** dado o admin, quando convida ou revoga um member, então
  a operação funciona. Quando tenta convidar admin/owner, alterar qualquer papel
  ou revogar admin/owner/a si próprio, então recebe negação e nada muda.
- **Resultado esperado:** somente as duas capacidades aprovadas para member são
  efetivas.
- **Variações e limites:** alvo cujo papel muda entre leitura e mutação; UUID de
  member de outra organização.
- **Automação sugerida:** sim, `apps/api/test/organizations.rbac.test.ts` e
  `apps/api/test/organizations.http.integration.test.ts`.

### TC-009 — Limitar member ao uso e listagem de membros

- **Objetivo:** provar que `member` acessa a organização e lista membros, mas
  não administra acesso.
- **Relações:** matriz de autorização; AC-005; R-005.
- **Prioridade:** P0.
- **Nível:** unitário e integração HTTP.
- **Pré-condições:** member ativo e demais papéis presentes.
- **Dados:** todos os endpoints de convite, patch e delete.
- **Dado/Quando/Então:** dado um member, quando acessa a organização e lista
  membros, então obtém dados permitidos. Quando tenta convidar, alterar papel ou
  revogar qualquer usuário, então recebe negação sem efeito persistente.
- **Resultado esperado:** ações de gestão são fail-closed, inclusive com body ou
  `userId` adulterado.
- **Variações e limites:** member recém-promovido ou recém-rebaixado e sessão
  antiga ainda válida.
- **Automação sugerida:** sim, mesmos arquivos de RBAC de TC-008.

### TC-010 — Preservar ao menos um owner sob operações concorrentes

- **Objetivo:** impedir remoção ou rebaixamento do último owner, inclusive em
  corrida.
- **Relações:** regra de ownership; AC-007; R-003.
- **Prioridade:** P0.
- **Nível:** integração concorrente com PostgreSQL real.
- **Pré-condições:** caso A com um owner; caso B com dois owners.
- **Dados:** revogação e rebaixamento simultâneos em transações separadas.
- **Dado/Quando/Então:** dado um único owner, quando ele é rebaixado ou
  revogado, então a operação falha. Dados dois owners, quando duas operações
  concorrentes tentam remover/rebaixar cada um, então no máximo uma conclui e ao
  menos um owner permanece após ambos os commits.
- **Resultado esperado:** a invariante vale no estado confirmado, sem depender
  apenas de contagem previamente lida na aplicação.
- **Variações e limites:** revoke/revoke, revoke/demote, demote/demote, ordem de
  commit invertida e retry após conflito.
- **Automação sugerida:** sim,
  `packages/database/test/last-owner.concurrent.integration.test.ts`.

### TC-011 — Transferir ownership sem janela sem owner

- **Objetivo:** validar a transferência conforme o modelo de promoção aprovado.
- **Relações:** matriz de autorização e regra de transferência; AC-007; R-003.
- **Prioridade:** P0.
- **Nível:** integração.
- **Pré-condições:** owner O e member M ativos na organização.
- **Dados:** promoção de M a `owner`; rebaixamento posterior e explícito de O.
- **Dado/Quando/Então:** dado O, quando promove M, então ambos podem ser owners.
  Quando O é depois rebaixado, então M permanece owner. Se promoção falha, a
  alteração posterior não pode deixar a organização sem owner.
- **Resultado esperado:** cada estado confirmado contém ao menos um owner, e M
  recebe as permissões de owner na requisição seguinte.
- **Variações e limites:** promoção concorrente com revogação de M e retry da
  promoção.
- **Automação sugerida:** sim,
  `apps/api/test/organizations.ownership.integration.test.ts`.

### TC-012 — Convidar somente conta existente, sem envio de email

- **Objetivo:** validar criação de convite, papéis permitidos e ausência de
  entrega externa.
- **Relações:** FR-005 e escopo; AC-005, AC-006; R-005, R-007, R-010.
- **Prioridade:** P1.
- **Nível:** integração e contrato.
- **Pré-condições:** destinatário existente sem membership ativo; owner e admin
  emissores.
- **Dados:** emails sintéticos em caixa mista; papéis `member`, `admin`,
  `owner`.
- **Dado/Quando/Então:** dado um owner, quando convida a conta para qualquer
  papel, então o convite registra organização, destinatário, papel, emissor,
  validade de 7 dias, status e timestamps. Dado um admin, somente convite
  `member` conclui.
- **Resultado esperado:** sucesso retorna `201`; nenhum SMTP, webhook ou
  mensagem externa é acionado; nenhum email completo aparece em log.
- **Variações e limites:** caixa e espaços no identificador após normalização
  definida; destinatário com membership revogado.
- **Automação sugerida:** sim,
  `apps/api/test/organization-invitations.integration.test.ts`, com adaptadores
  externos ausentes ou spies estritos.

### TC-013 — Rejeitar convite inválido sem enumerar contas

- **Objetivo:** impedir convite para conta inexistente ou entrada inválida sem
  criar artefato parcial.
- **Relações:** FR-005, FR-009; risco de enumeração declarado; R-007.
- **Prioridade:** P1.
- **Nível:** contrato e integração.
- **Pré-condições:** ator autorizado e ator sem permissão.
- **Dados:** email inexistente, malformado, muito longo e conta de outra caixa
  sintética.
- **Dado/Quando/Então:** quando o ator autorizado informa email inexistente ou
  destinatário indisponível, então nenhum convite é criado e ambos recebem o
  mesmo resultado público. Quando o ator não tem permissão, então a autorização
  falha antes de consultar a existência da conta.
- **Resultado esperado:** email inexistente e destinatário indisponível retornam
  `404 ORGANIZATION_USER_NOT_FOUND`; entrada malformada retorna validação; zero
  registro para alvo inválido e zero email completo em resposta/log.
- **Variações e limites:** caixa, Unicode, espaços e tentativa repetida.
- **Automação sugerida:** sim após estabilizar o contrato, em
  `packages/contracts/test/organizations.contracts.test.ts` e no teste HTTP.

### TC-014 — Restringir consulta e aceite ao destinatário e ao convite válido

- **Objetivo:** negar acesso por identidade ou estado incorreto.
- **Relações:** FR-006, FR-008; AC-004; R-001, R-007.
- **Prioridade:** P0.
- **Nível:** integração.
- **Pré-condições:** convites pendente, expirado, cancelado e aceito para U;
  sessão de U e V.
- **Dados:** UUIDs de convite válidos, aleatórios e de outro destinatário.
- **Dado/Quando/Então:** dado V, quando lista ou aceita convite de U, então não
  o vê nem ganha acesso. Dado U, quando tenta convite expirado, cancelado ou já
  aceito, então nenhum novo acesso é concedido.
- **Resultado esperado:** somente U consulta o convite pendente próprio; estados
  inválidos e identidade diferente não criam nem reativam membership.
- **Variações e limites:** `expires_at` imediatamente antes, igual e depois de 7
  dias; na igualdade o convite está expirado e não concede acesso.
- **Automação sugerida:** sim,
  `apps/api/test/organization-invitations.integration.test.ts`.

### TC-015 — Aceitar convite atomicamente e uma única vez

- **Objetivo:** comprovar idempotência e atomicidade do aceite.
- **Relações:** FR-007; AC-003; R-004.
- **Prioridade:** P0.
- **Nível:** integração concorrente.
- **Pré-condições:** convite pendente para U; duas conexões e mesma sessão.
- **Dados:** duas requisições simultâneas com o mesmo `invitationId`.
- **Dado/Quando/Então:** quando ambos os aceites concorrem, então existe no
  máximo um membership ativo e o convite termina consumido uma única vez.
- **Resultado esperado:** aceite retorna `200`; não há duplicidade, papel
  divergente ou convite pendente após sucesso; retry não duplica o efeito.
- **Variações e limites:** membership ausente, revogado e já ativo; falha após
  atualizar convite e antes de ativar membership deve fazer rollback completo;
  corridas aceitar/revogar e aceitar/cancelar exigem a decisão da lacuna 10 e
  nunca podem criar dois memberships.
- **Automação sugerida:** sim,
  `packages/database/test/invitation-accept.concurrent.integration.test.ts` e
  caso de uso da API.

### TC-016 — Tratar convites duplicados e retry de criação

- **Objetivo:** tornar explícito o comportamento sob repetição e concorrência na
  criação do convite.
- **Relações:** FR-005, FR-007; R-004.
- **Prioridade:** P1.
- **Nível:** integração concorrente.
- **Pré-condições:** conta existente e ator autorizado.
- **Dados:** mesmo destinatário, organização e papel em duas requisições.
- **Dado/Quando/Então:** quando os requests concorrem ou um request é repetido,
  então no máximo um convite pendente é criado para o par organização e
  destinatário.
- **Resultado esperado:** uma criação retorna `201`; a duplicata pendente
  retorna `409`, sem segundo registro nem alteração silenciosa de papel.
- **Variações e limites:** papéis diferentes, convite expirado/cancelado e
  membership já ativo.
- **Automação sugerida:** sim, no arquivo concorrente de convites.

### TC-017 — Efetivar revogação na requisição seguinte

- **Objetivo:** provar que sessão, cache e URL direta não preservam autorização
  revogada.
- **Relações:** FR-010; AC-008; R-005, R-006.
- **Prioridade:** P0.
- **Nível:** integração HTTP e E2E.
- **Pré-condições:** U com sessão Supabase válida e organização já carregada;
  owner autorizado a revogá-lo.
- **Dados:** requests antes e depois do commit de revogação.
- **Dado/Quando/Então:** dado que U acessa A, quando o owner revoga U e a
  transação confirma, então a próxima requisição de U por API e por
  `/organizations/:slug` é negada, mesmo com o mesmo cookie de sessão.
- **Resultado esperado:** nenhum dado stale reaparece como autorizado; cache de
  queries é invalidado ou substituído por estado de acesso negado.
- **Variações e limites:** aba já aberta, refresh do navegador, request iniciado
  antes do commit e novo request depois do commit.
- **Automação sugerida:** integração em
  `apps/api/test/organizations.revocation.integration.test.ts` e jornada E2E em
  `apps/web/e2e/organizations-access.spec.ts` quando houver harness.

### TC-018 — Não oferecer nem aceitar auto-saída

- **Objetivo:** garantir que nenhum papel remova o próprio vínculo por uma ação
  de saída disfarçada.
- **Relações:** FR-011 e matriz de autorização; escopo aprovado; R-003, R-005.
- **Prioridade:** P1.
- **Nível:** contrato e integração HTTP.
- **Pré-condições:** sessões separadas de owner, admin e member.
- **Dados:** `DELETE .../members/:userId` com o próprio `userId`; caminhos
  plausíveis de `/leave`.
- **Dado/Quando/Então:** quando cada ator procura ou chama auto-saída, então não
  existe endpoint público para isso. Quando tenta revogar a si próprio pelo
  endpoint de membros, então a operação é negada e o membership permanece.
- **Resultado esperado:** ausência de ação na UI/contrato e negação server-side,
  sem depender apenas de esconder botão.
- **Variações e limites:** organização com vários owners e admin tentando se
  revogar.
- **Automação sugerida:** sim,
  `apps/api/test/organizations.http.integration.test.ts` e teste de componente.

### TC-019 — Garantir slug único, case-insensitive e imutável

- **Objetivo:** proteger identidade canônica e roteamento da organização.
- **Relações:** decisão 8 da ADR; AC-012; R-007, R-008.
- **Prioridade:** P0.
- **Nível:** contrato e integração concorrente.
- **Pré-condições:** organização `operacao-norte` existente.
- **Dados:** `OPERACAO-NORTE`, variantes de caixa e dois creates simultâneos;
  slugs inválidos após definição da gramática.
- **Dado/Quando/Então:** quando se cria variante apenas de caixa ou duas
  organizações concorrentes com slug equivalente, então no máximo uma existe.
  Quando qualquer update tenta mudar o slug, então o contrato não oferece o
  campo ou o servidor rejeita e a URL canônica permanece.
- **Resultado esperado:** unicidade garantida no banco, não só por precheck;
  slug não muda após criação.
- **Variações e limites:** comprimento mínimo/máximo, hífens e Unicode aguardam
  a lacuna 4.
- **Automação sugerida:** sim,
  `packages/database/test/organizations.constraints.integration.test.ts` e
  contratos compartilhados.

### TC-020 — Validar contratos e fronteira das mutações HTTP

- **Objetivo:** rejeitar entrada e contexto de segurança inválidos antes do caso
  de uso.
- **Relações:** contratos HTTP da spec; FR-009, FR-013; AC-012.
- **Prioridade:** P1.
- **Nível:** contrato.
- **Pré-condições:** sessão BFF válida e schemas compartilhados estabilizados.
- **Dados:** UUID inválido, slug inválido, email inválido, papel fora do enum,
  body ausente/excedente e `Content-Type` incorreto.
- **Dado/Quando/Então:** quando cada endpoint recebe entrada inválida, então
  responde como validação e não chama persistência. Quando mutação recebe origem
  não confiável ou body não JSON, então é rejeitada conforme a fronteira BFF.
- **Resultado esperado:** autenticação, autorização, validação e
  indisponibilidade têm códigos distinguíveis sem vazar existência do tenant;
  criação retorna `201`, aceite retorna `200`, duplicata pendente retorna `409`
  e destinatário inexistente/indisponível retorna o mesmo
  `404 ORGANIZATION_USER_NOT_FOUND` após autorização.
- **Variações e limites:** campos extras, `null`, strings vazias, UUID de outra
  organização e body grande.
- **Automação sugerida:** sim,
  `packages/contracts/test/organizations.contracts.test.ts` e
  `apps/api/test/organizations.http.contract.test.ts`.

### TC-021 — Listar separadamente organizações e convites na home

- **Objetivo:** representar os dois conjuntos sem misturar acesso ativo e
  convite pendente.
- **Relações:** FR-004, FR-006; AC-013; R-006, R-009.
- **Prioridade:** P1.
- **Nível:** componente com contratos mockados e integração HTTP.
- **Pré-condições:** U com duas memberships ativas, uma revogada e dois convites
  pendentes próprios.
- **Dados:** nomes e slugs distintos; convite de organização ainda inacessível.
- **Dado/Quando/Então:** quando a home carrega, então exibe apenas as duas
  organizações ativas na seção de acesso e os convites pendentes em seção
  própria. Membership revogado e convites de outro usuário não aparecem.
- **Resultado esperado:** cada item tem nome, contexto e ação semanticamente
  identificáveis; convite não é apresentado como acesso já concedido.
- **Variações e limites:** apenas organizações, apenas convites e atualização
  depois de aceitar ou revogar.
- **Automação sugerida:** sim,
  `apps/web/test/organizations-home.component.test.tsx` e contratos da API.

### TC-022 — Cobrir loading, vazio, erro, retry e acessibilidade da home

- **Objetivo:** validar UX recuperável, mobile first e operável por teclado.
- **Relações:** NFR de frontend; AC-013; R-009.
- **Prioridade:** P1.
- **Nível:** componente; E2E apenas para jornada crítica.
- **Pré-condições:** respostas controláveis para organizações e convites.
- **Dados:** loading independente, ambos vazios, falha em uma ou nas duas fontes
  e sucesso após retry.
- **Dado/Quando/Então:** quando dados carregam, então há status anunciado sem
  expor conteúdo stale como autorizado. Quando vazio, cada seção explica seu
  estado. Quando falha, erro e retry são visíveis, anunciados e operáveis; após
  retry bem-sucedido, o conteúdo correto substitui o erro.
- **Resultado esperado:** foco previsível, ordem semântica, nomes acessíveis,
  contraste do Design System e nenhuma rolagem horizontal a 320 CSS px.
- **Variações e limites:** teclado, zoom 200%, texto longo em pt-BR/en e toque.
- **Automação sugerida:** componente em
  `apps/web/test/organizations-home.component.test.tsx`; auditoria automatizada
  de acessibilidade e um smoke E2E mobile.

### TC-023 — Preservar URL organizacional após login sem open redirect

- **Objetivo:** retornar à organização originalmente solicitada com destino
  interno validado.
- **Relações:** FR-014; AC-011; R-008.
- **Prioridade:** P0.
- **Nível:** unitário e E2E.
- **Pré-condições:** usuário anônimo, depois credenciais válidas; rota por slug
  registrada como protegida.
- **Dados:** `/organizations/operacao-norte?view=week#today`, URL absoluta,
  protocol-relative, backslash e caminho desconhecido.
- **Dado/Quando/Então:** quando o anônimo abre a URL organizacional, então é
  enviado a `/login?next=...`. Após login, retorna ao mesmo path, query e hash.
  Quando `next` é externo ou não reconhecido, então cai em `/`.
- **Resultado esperado:** destino válido preservado exatamente uma vez, sem loop
  ou redirecionamento externo.
- **Variações e limites:** slug em caixa canônica, caracteres codificados,
  sessão já válida e refresh da tela de login.
- **Automação sugerida:** ampliar `apps/web/test/auth-redirect.test.ts` e criar
  jornada em `apps/web/e2e/organizations-navigation.spec.ts`.

### TC-024 — Representar acesso direto válido, negado e inexistente

- **Objetivo:** validar a página organizacional sem enumeração ou flash de
  dados.
- **Relações:** FR-013, FR-014; AC-008, AC-012; R-006, R-007, R-009.
- **Prioridade:** P1.
- **Nível:** componente e E2E.
- **Pré-condições:** sessão com acesso a A, sem acesso a B e slug inexistente.
- **Dados:** URLs diretas das três condições.
- **Dado/Quando/Então:** quando abre A, então vê seu contexto. Quando abre B ou
  slug inexistente, então não vê nome nem dados e recebe apresentação pública
  indistinguível conforme o contrato. Durante loading ou retry, nenhum dado do
  tenant anterior é exibido.
- **Resultado esperado:** estados loading, acesso negado/inexistente e erro são
  acessíveis e mobile first; troca de slug invalida o cache correto.
- **Variações e limites:** back/forward, duas abas, revogação durante a página e
  navegação rápida A→B.
- **Automação sugerida:** componente e
  `apps/web/e2e/organizations-access.spec.ts`.

### TC-025 — Exigir organization_id e integridade referencial

- **Objetivo:** impedir dado tenant-specific órfão ou sem contexto de tenant.
- **Relações:** FR-001, FR-005, FR-012; AC-009; R-001.
- **Prioridade:** P0.
- **Nível:** integração de banco.
- **Pré-condições:** todas as tabelas da entrega catalogadas.
- **Dados:** `organization_id` nulo, inexistente e de outra organização;
  destinatário/emissor inexistentes.
- **Dado/Quando/Então:** quando inserts inválidos são tentados, então
  constraints e RLS rejeitam. Quando a organização ou usuário referenciado não
  pode ser removido segundo o escopo, então não há cascade acidental que viole
  auditoria ou a invariante de owner.
- **Resultado esperado:** FKs, `NOT NULL`, enums/checks, índices e políticas
  cobrem cada tabela tenant-specific do catálogo.
- **Variações e limites:** timestamps inconsistentes, papel fora do enum e
  status de convite inválido.
- **Automação sugerida:** sim,
  `packages/database/test/organizations.constraints.integration.test.ts`.

### TC-026 — Sanitizar logs e correlacionar decisões

- **Objetivo:** permitir diagnóstico sem expor credenciais ou PII.
- **Relações:** NFR de logs; R-010.
- **Prioridade:** P1.
- **Nível:** integração.
- **Pré-condições:** logger capturado; casos de sucesso e falha de convite,
  aceite, RBAC e RLS.
- **Dados:** email sintético único, token-canário e conteúdo-canário no payload.
- **Dado/Quando/Então:** quando cada fluxo executa, então logs possuem
  categoria, resultado e correlation ID úteis, mas não contêm cookie, token,
  conteúdo sensível de convite ou email completo.
- **Resultado esperado:** canários sensíveis não aparecem em logs ou erros; a
  decisão pode ser ligada à requisição sem identificar desnecessariamente a
  pessoa.
- **Variações e limites:** erro de validação, exceção do banco, conflito
  concorrente e indisponibilidade.
- **Automação sugerida:** sim,
  `apps/api/test/organizations.observability.test.ts`.

## 6. Estratégia e níveis de teste

- **Unitário:** matriz RBAC e transformações puras de slug/redirect. Não repetir
  aqui o isolamento que depende do PostgreSQL.
- **Contrato:** schemas compartilhados, status/códigos HTTP, `Content-Type`,
  autenticação BFF, origem e proteção CSRF.
- **Integração:** principal nível da entrega. Deve usar PostgreSQL real com a
  role de runtime, transações concorrentes e a migração produzida.
- **Componente:** home e página organizacional, incluindo loading, vazio, erro,
  retry, acesso negado, teclado e responsividade.
- **Ponta a ponta:** somente retorno pós-login, aceite crítico e perda de acesso
  após revogação. A maior parte da combinatória fica nos níveis inferiores.

O mesmo comportamento não deve ser duplicado em todos os níveis. Em especial,
mock de repositório não serve como evidência de RLS, ownership, grants ou
corrida transacional.

## 7. Dados e ambiente necessários

- PostgreSQL local isolado, com migrações aplicadas e credenciais separadas de
  migração e runtime;
- Supabase Auth local com contas sintéticas U, V e W, sem dados pessoais;
- organizações A e B, memberships cobrindo todos os papéis e vínculo revogado;
- convites pendente, expirado, cancelado e aceito, com relógio controlável;
- pool configurável para uma conexão e para concorrência real;
- mecanismo de sincronização por barrier/latch nos testes concorrentes, evitando
  depender de sleeps;
- frontend em 320 CSS px, desktop, zoom 200%, pt-BR e en;
- logger capturável e tokens-canário exclusivamente sintéticos.

Os testes de banco precisam confirmar com `current_user`, `pg_roles`,
`pg_class`, `pg_policies` e grants que executam como runtime real. Rodar como
owner da tabela produz falso positivo de cobertura.

## 8. Resultados e evidências de execução

### Aprovados

- Nenhum cenário de organizations foi executado ou aprovado nesta fase.
- Baseline de redirect: 1 arquivo e 7 testes aprovados pelo comando registrado
  em E-004.
- Contracts: 2 arquivos e 11 testes aprovados, conforme E-005. Isso cobre
  parsing parcial, não critérios de aceite da jornada.
- Database unitário/estático: 2 arquivos e 6 testes aprovados, conforme E-006.
  Isso não cobre a migration em banco real.

### Reprovados

- Nenhum TC de organizations foi executado até produzir reprovação. A inspeção
  do diff parcial encontrou os achados DEF-001 a DEF-003 abaixo. DEF-001 e
  DEF-003 foram divergências confirmadas no snapshot inicial e receberam
  correções estáticas; a comprovação em PostgreSQL continua pendente.

### Não executados

- TC-001 a TC-026: implementação completa e ambiente de teste ainda ausentes.
- Verificações completas `pnpm lint`, `pnpm typecheck`, `pnpm test` e
  `pnpm build`: fora do objetivo deste planejamento pré-implementação.

## 9. Defeitos encontrados

### DEF-001 — Policy permite consultar convite alheio

- **Classificação:** defeito confirmado no snapshot inicial e corrigido
  estaticamente no diff atual; reprodução runtime ainda não executada.
- **Severidade:** alta.
- **Ambiente:** diff parcial da migration
  `packages/database/drizzle/0001_overrated_virginia_dare.sql`.
- **Pré-condições:** U recebe convite para A; V possui membership ativo em A; a
  consulta roda como `arcsyn_shift_runtime` com principal V.
- **Passos mínimos:** definir contexto de V; consultar
  `organization_invitations` sem filtrar pelo destinatário.
- **Resultado esperado:** FR-006 e AC-004 exigem que somente U consulte o
  convite próprio.
- **Resultado observado:** a policy `invitations_recipient_or_member_select`
  aceitava `invited_user_id = current_user` **ou** qualquer membro ativo da
  organização. No diff atual, a policy foi restringida ao destinatário.
- **Evidência:** migration, linhas 294–299 no snapshot inicial e linhas 338–340
  no snapshot corrigido.
- **Impacto:** outro usuário pode observar existência, papel, emissor, validade
  e status do convite; viola privacidade e autorização.
- **Requisito afetado:** FR-006, AC-004; TC-014.
- **Encaminhamento:** executar TC-014 em PostgreSQL real; o teste textual atual
  não prova o resultado da policy aplicada.

### DEF-002 — Serialização do último owner ainda não foi comprovada

- **Classificação:** defeito provável no snapshot inicial; mitigação adicionada,
  mas confirmação exige TC-010 em PostgreSQL real.
- **Severidade:** alta.
- **Ambiente:** mesmo diff parcial de migration.
- **Pré-condições:** organização com exatamente dois owners; duas transações
  concorrentes rebaixam/revogam owners diferentes.
- **Passos mínimos:** iniciar ambas as transações; fazer cada trigger observar o
  outro owner ainda ativo; confirmar ambas.
- **Resultado esperado:** no máximo uma operação confirma e ao menos um owner
  permanece.
- **Resultado observado:** o snapshot inicial usava `NOT EXISTS` sem lock. O
  diff atual adiciona `pg_advisory_xact_lock` dentro do `BEFORE UPDATE` trigger;
  falta provar que a transação bloqueada não reutiliza snapshot anterior ao
  commit vencedor.
- **Evidência:** function `ensure_organization_has_owner`, linhas 380–411 no
  snapshot atual.
- **Impacto:** organização pode ficar sem owner e sem caminho autorizado de
  administração.
- **Requisito afetado:** AC-007 e decisão 10 da ADR; TC-010.
- **Encaminhamento:** adquirir lock antes da leitura/update quando necessário e
  comprovar com transações coordenadas, sem `sleep` como oráculo.

### DEF-003 — Exemplos locais usavam superuser como runtime

- **Classificação:** divergência confirmada no snapshot inicial e corrigida nos
  exemplos atuais; validação do ambiente real ainda pendente.
- **Severidade:** alta.
- **Ambiente:** `.env.example` e `apps/api/.env.example` no snapshot
  inspecionado.
- **Pré-condições:** iniciar a API usando os exemplos versionados.
- **Passos mínimos:** conectar por `DATABASE_URL`; consultar `current_user` e
  atributos em `pg_roles`; observar a credencial `postgres`; sair da transação
  que executa `SET LOCAL ROLE`.
- **Resultado esperado:** a conexão da aplicação é uma role de runtime sem
  superuser, `BYPASSRLS` ou ownership, separada da migração.
- **Resultado observado:** inicialmente, `DATABASE_URL` e
  `DATABASE_MIGRATION_URL` usavam `postgres`. O diff atual aponta runtime ao
  login local dedicado `arcsyn_shift_app_local`, mas isso ainda não foi
  exercitado contra `pg_roles` e ownership reais.
- **Evidência:** `.env.example:2-3`, `apps/api/.env.example:2`,
  `supabase/roles.sql` e `packages/database/src/index.ts:21-27`.
- **Impacto:** código que escape do helper ou comprometimento da conexão mantém
  capacidade de contornar RLS, invalidando AC-010.
- **Requisito afetado:** NFR de runtime e AC-010; TC-005.
- **Encaminhamento:** executar o gate TC-005 com o login efetivo e manter a
  credencial de migração fora da API.

A ausência atual da rota e da allowlist de organizations é uma lacuna esperada
do baseline, não uma regressão, porque a implementação web ainda não estava
disponível.

## 10. Cobertura ausente e riscos residuais

- sem implementação não há evidência para nenhum AC-001 a AC-013;
- sem teste PostgreSQL real não há evidência de RLS, `FORCE RLS`, role runtime
  ou isolamento do pool;
- sem contrato de erro organizacional não se comprova não enumeração por slug;
- sem regra de cancelamento e aceite/revogação concorrentes não se fecha todo o
  lifecycle de convite;
- sem harness de componente/E2E não se comprova foco, teclado, cache, mobile ou
  retorno pós-login;
- a revisão especializada de abuso, `SECURITY DEFINER`, grants e PII deve ser
  coordenada com o `security_reviewer`; este plano não a substitui;
- desempenho e volume permanecem sem meta mensurável.

## 11. Recomendações de automação

1. Tornar TC-004, TC-005, TC-006, TC-010 e TC-015 gates obrigatórios de CI em um
   PostgreSQL efêmero com a role real de runtime.
2. Gerar a matriz RBAC como teste parametrizado por papel × ação × papel alvo,
   mantendo uma única fonte de casos esperados.
3. Usar concorrência coordenada por transações/barriers para aceite e último
   owner; não usar atraso temporal como oráculo.
4. Ampliar imediatamente `auth-redirect.test.ts` para slugs organizacionais e
   manter um único E2E de retorno pós-login.
5. Adotar testes de componente baseados em comportamento e acessibilidade, não
   em busca textual do source.
6. Criar um inventário automatizado de tabelas tenant-specific e falhar se
   alguma não tiver `organization_id`, `ENABLE RLS`, `FORCE RLS` e policies.

## 12. Itens não verificados

- implementação e diff final;
- SQL gerado, constraints, índices, policies, functions e grants;
- contratos compartilhados e catálogo de erros;
- comportamento real de todos os endpoints;
- UI, traduções, foco, responsividade e cache;
- revisão do `security_reviewer` e resolução das ambiguidades da seção 3;
- comandos completos de lint, typecheck, test e build.

## 13. Checklist de aceite e artefato

- [ ] Todas as lacunas materiais da seção 3 foram resolvidas ou formalmente
      adiadas sem afetar os cenários P0.
- [ ] TC-001, TC-003 a TC-006, TC-008 a TC-011, TC-014, TC-015, TC-017, TC-019,
      TC-023 e TC-025 estão aprovados com evidência reproduzível.
- [ ] A matriz RBAC completa está automatizada e aprovada.
- [ ] A role de runtime real passa no gate de privilégio e RLS.
- [ ] Corridas de último owner e aceite foram executadas repetidamente sem
      violar invariantes.
- [ ] Estados de UX, acessibilidade e viewport móvel foram validados.
- [ ] Diff final foi comparado a FR-001–FR-014 e AC-001–AC-013.
- [ ] Testes aprovados, reprovados e não executados foram registrados
      separadamente.
- [ ] Verificações completas do monorepo foram executadas e anexadas.
- [ ] Revisão especializada de segurança foi reconciliada.

Artefato criado: `specs/005-organizations-rbac/checklists/qa.md`.
