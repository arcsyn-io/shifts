# Revisão de segurança: Organizations, RBAC e RLS

- **Data:** 2026-08-08
- **Tipo:** revisão final de implementação e modelo de ameaças
- **Estado avaliado:** implementação completa na branch
  `codex/organizations-rbac`, incluindo migration, API, frontend e testes
- **Confiança geral:** alta para o código e as validações locais executadas;
  média para operação no pooler e ambiente de produção

## 1. Resumo executivo

Foi confirmado um achado de severidade **Médio**: o endpoint de convite retorna
respostas distintas para email sem conta, conta já membro e conta convidável,
permitindo enumeração de contas por `owner` ou `admin` legítimo.

Não foram encontrados outros problemas de segurança confirmados no escopo. A
separação de roles, o contexto transacional, as policies RLS, o lock de owner, o
RBAC e a defesa CSRF foram implementados de forma coerente com a especificação e
possuem evidência de testes. Em particular, a migration foi aplicada, o teste
SQL real bloqueou leitura cross-tenant e a corrida real em duas conexões
preservou exatamente um owner ativo.

Esta conclusão é limitada ao escopo e ao ambiente verificados e não significa
que o sistema seja completamente seguro.

## 2. Escopo analisado

Foram inspecionados:

- `AGENTS.md`, princípios e fontes de verdade, visão arquitetural e fluxo de
  especificações/ADRs;
- `specs/005-organizations-rbac/spec.md`, plano e critérios de aceite;
- ADR-0003 de Supabase Auth/BFF e ADR-0004 de Organizations/RBAC/RLS;
- contratos Zod, schema Drizzle, migration, provisionamento das roles e helpers
  SQL;
- repository Drizzle, unidade transacional, services, RBAC, controllers, guards,
  mapeamento de erros e testes da API;
- cliente HTTP, roteamento, páginas, cache e testes do frontend;
- evidências locais de migration, RLS cross-tenant, concorrência de owner,
  configuração Supabase e suítes de API e web.

A revisão foi estática, complementada pelas evidências de execução informadas no
workspace. Não houve exploração contra dados reais nem validação no pooler ou no
ambiente de produção.

## 3. Ativos, atores, pontos de entrada e limites de confiança

### Ativos

- organizações, slugs, memberships, papéis e histórico de revogação;
- convites, destinatários, emissores, validade e status;
- email e UUID de identidades Supabase;
- contexto transacional de principal e organização;
- invariante de pelo menos um owner ativo;
- credenciais, ownership e privilégios das roles do PostgreSQL;
- trilha de auditoria das operações administrativas.

### Atores

- pessoa autenticada sem membership;
- `owner`, `admin` e `member` de cada organização;
- destinatário de convite;
- navegador, BFF NestJS, pool PostgreSQL e Supabase Auth;
- operador de migration e administrador do banco;
- atacante externo e usuário legítimo tentando BOLA/IDOR ou enumeração.

### Pontos de entrada e limites de confiança

1. navegador não confiável -> endpoints `/api/organizations*` e cookies BFF;
2. sessão Supabase validada -> principal interno sincronizado;
3. slug, UUID, email, papel e body não confiáveis -> contratos Zod e use cases;
4. use case autorizado -> transaction handle com principal e tenant locais;
5. role de runtime -> privilégios SQL, policies RLS e helpers privilegiados;
6. migration/owner -> DDL, grants, ownership e `SECURITY DEFINER`;
7. commit de mudança de papel/revogação -> autorização da requisição seguinte.

## 4. Modelo de ameaças e casos de abuso

| ID   | Pré-condição                             | Abuso e impacto                                | Controle observado                                                      |
| ---- | ---------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------- |
| T-01 | Runtime privilegiada                     | Consulta defeituosa ignora RLS e cruza tenants | Runtime `NOBYPASSRLS`, sem ownership, `ENABLE` e `FORCE RLS`            |
| T-02 | Contexto persiste na conexão             | Requisição B herda principal/tenant de A       | `set_config(..., true)` na mesma transação                              |
| T-03 | Mutações de owner concorrem              | Organização termina sem owner                  | advisory transaction lock, releitura e trigger                          |
| T-04 | Convite concorre com revogação           | Usuário recupera acesso indevido               | lock, revalidação e escrita atômica                                     |
| T-05 | Helper privilegiado excessivo            | Bypass de RLS amplia leitura/escrita           | owner dedicado `NOLOGIN BYPASSRLS`, grants mínimos e `search_path` fixo |
| T-06 | Email produz resultados distinguíveis    | Admin enumera contas existentes                | Lacuna confirmada em SEC-001                                            |
| T-07 | Mutação por cookie aceita origem externa | CSRF altera membros/convites                   | `BffMutationGuard`, Origin exata e JSON nas rotas com body              |
| T-08 | Slug global gera conflito observável     | Mapeamento de slugs ocupados                   | Erro sanitizado; rate limit ainda recomendado                           |
| T-09 | Erro interno é propagado                 | SQL, constraint ou stack vazam                 | mapeamento fechado para erros públicos                                  |

## 5. Achados ordenados por severidade

### Vulnerabilidades confirmadas

#### SEC-001 — Endpoint de convite permite enumeração de contas por email

- **Severidade:** Médio
- **Confiança:** alta
- **Localização:**
  `apps/api/src/modules/organizations/application/organizations.service.ts:150-154`,
  `apps/api/src/modules/organizations/presentation/http/helpers/organizations-http.ts:50-67`,
  `packages/contracts/src/index.ts:134-147`
- **Evidência:** `resolveInvitedUser` sem correspondência lança
  `user_not_found`, exposto como HTTP 404 e `ORGANIZATION_USER_NOT_FOUND`. Uma
  conta já membro produz HTTP 409 `ORGANIZATION_CONFLICT`, enquanto uma conta
  existente e convidável recebe HTTP 201 com convite. Logo, a existência da
  conta é observável.
- **Cenário de abuso:** um `owner` ou `admin` automatiza convites com uma lista
  de emails e classifica quais possuem conta no produto pelos status e corpos.
- **Pré-condições:** sessão válida com papel capaz de convidar em ao menos uma
  organização e conhecimento dos emails a testar.
- **Impacto técnico e de negócio:** correlação de PII e descoberta de adesão ao
  produto, útil para phishing direcionado, assédio ou investigação indevida por
  usuário interno.
- **Recomendação:** tornar a resposta pública uniforme para email inexistente,
  membro ativo, convite pendente e alvo convidável, preferencialmente com
  resultado assíncrono/genérico sem expor `ORGANIZATION_USER_NOT_FOUND`.
  Complementar com rate limit por principal e IP e auditoria sanitizada, sem
  email completo. A escolha de semântica HTTP/UX deve ser alinhada com o
  `requirements_architect` por alterar o contrato público.
- **Teste da correção:** para email inexistente, já membro, convite pendente e
  conta convidável, verificar status, código, corpo, headers e perfil temporal
  aproximadamente equivalentes; confirmar `429` após rajada e ausência de email
  completo em logs/eventos.

### Riscos de projeto

Não foram identificados riscos de projeto adicionais que atendam aos critérios
de achado no estado final inspecionado.

### Sugestões de endurecimento

#### SEC-002 — Slug global pode ser enumerado por conflito de criação

- **Severidade:** Baixo
- **Confiança:** alta
- **Localização:** `packages/contracts/src/index.ts:52-57`, ADR-0004 item 8
- **Evidência:** a unicidade global e case-insensitive é requisito aprovado. O
  repository sanitiza a violação como conflito genérico, mas a diferença entre
  criação e conflito ainda revela que o slug existe.
- **Cenário de abuso:** usuário autenticado cria organizações repetidamente para
  testar uma lista de slugs.
- **Pré-condições:** sessão válida e ausência de limite de taxa específico.
- **Impacto:** enumeração de baixo volume de identificadores públicos.
- **Recomendação:** limitar criação por principal/IP e manter erro sem nome de
  constraint, SQL ou dados da organização existente.
- **Teste da correção:** corrida de dois creates e rajada de slugs ocupados;
  resposta/log não contém constraint nem dados do tenant e o limite retorna
  `429`.

#### SEC-003 — Rate limits e auditoria de segurança não estão demonstrados

- **Severidade:** Informativo
- **Confiança:** alta
- **Localização:** endpoints de criação, convite, alteração de papel, revogação
  e aceite; ADR-0004 item 9
- **Evidência:** não foram localizados rate limiter nem eventos explícitos de
  auditoria para as operações de Organizations. O histórico de membership
  preserva campos de revogação, mas não substitui uma trilha correlacionável de
  tentativas, negações e resultados.
- **Cenário de abuso:** rajadas aumentam custo ou aceleram enumeração; uma ação
  administrativa indevida não pode ser reconstruída integralmente.
- **Pré-condições:** sessão válida ou tráfego automatizado até o BFF.
- **Impacto:** menor capacidade preventiva e de resposta a incidente.
- **Recomendação:** limitar por principal/IP e registrar ator, alvo,
  organização, ação, papel anterior/novo, resultado, timestamp e correlation ID,
  sem token, cookie ou email completo.
- **Teste da correção:** rajadas recebem `429` sem afetar outros tenants;
  sucesso, negação e corrida geram eventos correlacionáveis e sanitizados.

## 6. Controles existentes

- roles organizacionais não entram no JWT; cada requisição revalida sessão e
  membership atual;
- matriz RBAC impede `member` de administrar e limita `admin` a convidar ou
  revogar `member`; alteração de papel é exclusiva de `owner`;
- repositories operam pelo transaction handle contextual; não foi observado
  acesso paralelo pelo pool fora da unidade de trabalho;
- `arcsyn_shift_runtime` é `NOLOGIN NOBYPASSRLS` e a login local é
  `NOBYPASSRLS`; tabelas possuem `ENABLE` e `FORCE RLS`;
- helpers `SECURITY DEFINER` pertencem a role dedicada `NOLOGIN BYPASSRLS`, têm
  `search_path` fixo, referências qualificadas e grants mínimos de leitura;
- contexto usa `set_config(..., true)` e organização explícita na mesma
  transação;
- lock por organização, policies e triggers protegem transições e último owner;
- convite é aceito apenas pelo destinatário, com validade, revalidação e
  idempotência controlada;
- controllers usam `BffSessionGuard` para leitura e `BffMutationGuard` para
  mutação; Origin deve ser exata e rotas com body exigem `application/json`;
- contratos Zod são strict; UUID, email, papel, tamanho e slug são validados;
- respostas usam `Cache-Control: private, no-store` e erros internos são
  convertidos para vocabulário público fechado;
- frontend usa `credentials: same-origin`, codifica segmentos de URL, valida
  respostas e não injeta HTML não confiável;
- o redirect pós-login aceita somente caminhos locais canônicos e rejeita
  protocolo relativo, barra invertida e valores malformados.

## 7. Riscos aceitos ou residuais conhecidos

- slug globalmente único permite descoberta por tentativa de criação;
- RLS protege DML normal, não cobre `TRUNCATE` e não substitui RBAC;
- superuser e roles `BYPASSRLS` permanecem fora da proteção das policies;
- operação já autorizada pode concluir antes de uma revogação concorrente,
  conforme a ordem do lock/commit definida no ADR;
- revogação de membership não encerra a sessão Supabase, somente o acesso à
  organização;
- limites operacionais e auditoria permanecem como hardening pendente.

## 8. Recomendações priorizadas

1. Corrigir SEC-001 antes de expor o convite a usuários não confiáveis e
   atualizar contrato, testes e UX com resposta anti-enumeração.
2. Adicionar rate limit e auditoria sanitizada aos fluxos administrativos.
3. Manter a prova real de RLS cross-tenant e corrida de owner como teste de
   regressão automatizado em CI com PostgreSQL descartável.
4. Revisar grants, ownership, `search_path`, `ENABLE` e `FORCE RLS` a cada nova
   migration ou helper privilegiado.
5. Validar a mesma matriz no pooler e na topologia de produção antes do rollout.

## 9. Testes de segurança recomendados

Já executados com resultado positivo:

- migration aplicada com sucesso;
- SQL real como `app_local` após `SET ROLE arcsyn_shift_runtime`: tenant A
  retornou uma organização e uma membership; ao trocar para tenant B sem
  membership, retornou zero memberships;
- corrida real com duas conexões tentando remover/rebaixar owners: estado final
  com exatamente um owner ativo;
- `pnpm supabase:check`: 5/5;
- API: 124/124 testes;
- web: 85/85 testes;
- dados sintéticos usados na validação foram removidos.

Ainda recomendados:

1. resposta anti-enumeração para todos os estados do convite, incluindo
   equivalência aproximada de tempo e rate limit;
2. matriz RLS por tabela/comando para contexto ausente, malformado, revogado,
   tenant correto e tenant alheio;
3. reuso da mesma conexão após commit, rollback, timeout e exceção;
4. races `accept/accept`, `accept/revoke`, `accept/cancel` e transferência de
   owner com mais de duas conexões;
5. matriz completa de RBAC por ator, alvo, papel, ação e self-target;
6. inspeção de logs/telemetria para ausência de SQL, stack, constraint, token,
   cookie e email completo;
7. validação de ACL e ownership efetivos após migration no ambiente de destino;
8. regressão CSRF parametrizada para toda nova rota mutável.

## 10. Impactos arquiteturais para encaminhamento

- A resposta anti-enumeração de SEC-001 altera o contrato público e a UX de
  convite; encaminhar a decisão ao `requirements_architect` e atualizar a
  especificação antes da implementação.
- Qualquer ampliação dos grants da role `arcsyn_shift_rls`, novo helper
  `SECURITY DEFINER` ou adoção de identificador diferente de email exige nova
  análise e possível ADR.

## 11. Itens não verificados

- atributos e ACLs no ambiente de produção após deploy;
- comportamento do pooler/transação na topologia do provedor;
- rate limits, WAF, observabilidade, retenção e alertas operacionais;
- equivalência temporal real das respostas do endpoint de convite;
- testes de carga, abuso de recursos e recuperação de incidentes;
- dependências e imagens de deploy, por não fazerem parte do diff analisado.

## 12. Artefatos criados ou atualizados

- atualizado `docs/security/organizations-rbac-rls.md` com a revisão final,
  evidências reais e SEC-001 confirmado;
- nenhum código-fonte, teste, dependência, configuração, migration ou
  infraestrutura foi alterado por esta revisão.

## Referências técnicas

- [PostgreSQL 17: Row Security Policies](https://www.postgresql.org/docs/17/ddl-rowsecurity.html)
- [PostgreSQL 17: `CREATE FUNCTION` e `SECURITY DEFINER`](https://www.postgresql.org/docs/17/sql-createfunction.html)
- [PostgreSQL 17: `current_setting` e `set_config`](https://www.postgresql.org/docs/17/functions-admin.html)
- [PostgreSQL 17: `search_path` e `row_security`](https://www.postgresql.org/docs/17/runtime-config-client.html)
