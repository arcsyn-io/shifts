# Especificação: autenticação web com JWT em cookie HttpOnly

- **Status:** Aprovada
- **Data:** 2026-08-03
- **Funcionalidade:** autenticação da aplicação web
- **ADR relacionada:**
  [ADR-0003](../../docs/architecture/decisions/0003-sessao-web-jwt-cookie-http-only.md)

## Objetivo e valor de negócio

Permitir que pessoas previamente provisionadas acessem capacidades protegidas do
ArcSyn Shift por meio da aplicação web, sem expor credenciais de sessão ao
JavaScript. A funcionalidade estabelece uma fronteira de autenticação segura e
auditável para a evolução do produto.

## Atores

- **Usuário provisionado:** possui uma conta local ativa e autentica-se com
  email e senha.
- **Operador interno:** provisiona e desativa contas por processo interno fora
  da interface pública desta funcionalidade.
- **Operação da plataforma:** configura segredos, origins e limites, monitora
  falhas e executa rotação de chaves.

## Dentro do escopo

- autenticação local por email e senha;
- contas criadas por provisionamento interno;
- login, restauração da sessão, renovação e logout;
- access JWT de 10 minutos transportado exclusivamente em cookie HttpOnly;
- refresh token opaco, rotativo, com validade máxima de 30 dias;
- revogação e detecção de replay por família de refresh tokens;
- proteção global das rotas HTTP, com allowlist pública explícita;
- proteção contra CSRF em operações mutáveis;
- limitação persistida de tentativas de autenticação;
- contratos compartilhados entre web e API;
- observabilidade sem exposição de dados sensíveis.

## Fora do escopo

- cadastro público;
- convite, recuperação ou redefinição de senha pelo usuário;
- MFA, SSO ou provedor de identidade externo;
- papéis, permissões ou autorização por função;
- interface pública para provisionar ou administrar contas;
- autenticação do transporte MCP;
- painel de dispositivos ou sessões ativas.

## Jornadas

### Login

1. O usuário informa email e senha.
2. A API valida o formato, o limite de tentativas, a conta ativa e a senha.
3. Em caso de sucesso, a API cria uma família de refresh tokens, persiste
   somente o hash necessário e emite os cookies de sessão.
4. O web recebe apenas os dados públicos do usuário e navega para a área
   protegida.

### Restauração e renovação

1. Ao iniciar ou recarregar, o web consulta a sessão atual.
2. Enquanto o access JWT estiver válido, a API retorna o principal autenticado.
3. Quando necessária, a renovação consome o refresh token atual, o invalida e
   emite um novo par dentro da mesma família.
4. A reutilização de um refresh token já consumido revoga toda a família.

### Logout

1. O usuário solicita logout a partir do `Origin` permitido. A API pode aceitar
   a ausência do token CSRF nesse endpoint para não impedir a revogação de um
   refresh token identificável.
2. A API revoga a família da sessão, mesmo que o access JWT ainda esteja válido.
3. A API remove todos os cookies de autenticação e CSRF associados.
4. O web elimina o estado remoto da sessão e retorna à área pública.

## Requisitos funcionais

- **FR-001:** o sistema deve autenticar somente contas locais ativas,
  provisionadas internamente, por email e senha.
- **FR-002:** o sistema deve normalizar o email de maneira consistente antes da
  busca, sem alterar silenciosamente sua identidade semântica.
- **FR-003:** o sistema deve armazenar senhas somente como hashes produzidos por
  um algoritmo resistente a ataques offline, com parâmetros revisados pelo
  revisor de segurança.
- **FR-004:** uma autenticação bem-sucedida deve emitir um access JWT com
  validade de 10 minutos no cookie `__Host-arcsyn_access` em produção e
  `arcsyn_access` no desenvolvimento local por HTTP.
- **FR-005:** em produção, os cookies de access, refresh e CSRF devem usar o
  prefixo `__Host-`, `Secure`, `Path=/`, ausência de `Domain` e `SameSite=Lax`.
  No desenvolvimento local por HTTP, devem usar os nomes equivalentes sem
  `__Host-` e sem `Secure`, mantendo `Path=/`, ausência de `Domain` e
  `SameSite=Lax`.
- **FR-006:** a API deve aceitar o access JWT exclusivamente pelo cookie oficial
  e rejeitar o mesmo token enviado no corpo, na URL ou em `Authorization`.
- **FR-007:** o sistema deve emitir um refresh token opaco e imprevisível, em
  cookie HttpOnly separado, com validade máxima de 30 dias.
- **FR-008:** o PostgreSQL deve armazenar somente o hash do refresh token, sua
  família, estado, usuário, datas de criação, expiração, consumo e revogação.
- **FR-009:** cada renovação deve consumir o refresh token apresentado e emitir
  outro token na mesma família.
- **FR-010:** a apresentação de refresh token consumido, revogado, expirado ou
  desconhecido deve falhar e revogar a família quando caracterizar replay.
- **FR-011:** `DELETE /api/auth/session` deve realizar o logout, revogar a
  família da sessão e expirar os cookies com atributos compatíveis com os usados
  na emissão.
- **FR-012:** a API deve fornecer um endpoint de sessão que retorne somente o
  identificador e o email necessários à interface, nunca tokens ou hash de
  senha.
- **FR-013:** um guard global deve exigir autenticação por padrão; somente
  endpoints marcados explicitamente podem ser públicos.
- **FR-014:** no escopo inicial, apenas health e autenticação devem compor a
  allowlist pública necessária.
- **FR-015:** Swagger deve estar disponível somente no ambiente de
  desenvolvimento.
- **FR-016:** MCP deve permanecer desabilitado em todos os ambientes cobertos
  pela autenticação web.
- **FR-017:** toda requisição mutável autenticada deve validar o `Origin` exato
  e um token CSRF associado à sessão. O login deve validar o `Origin` exato para
  mitigar login CSRF, mesmo sem exigir token CSRF, pois ainda não existe sessão.
- **FR-018:** o token CSRF pode ser acessível ao cliente, mas não deve conter
  nem substituir qualquer credencial de autenticação.
- **FR-019:** login e renovação devem possuir rate limit persistido, capaz de
  manter os contadores entre instâncias e reinicializações da API.
- **FR-020:** falhas de login devem usar resposta genérica, sem distinguir conta
  inexistente, inativa ou senha incorreta.
- **FR-021:** o web deve restaurar a sessão sem ler os cookies de autenticação e
  deve limpar seu estado remoto após `401`, logout ou replay detectado.
- **FR-022:** após login, o web só deve aceitar destinos internos previamente
  validados, impedindo redirecionamento aberto.

## Requisitos não funcionais

- **NFR-001 — Segurança:** JWTs devem validar algoritmo permitido, assinatura,
  `iss`, `aud`, `sub`, `iat`, `exp` e identificador de sessão.
- **NFR-002 — Segredos:** chaves, peppers e tokens não podem estar em código,
  bundle, logs, exemplos ou respostas e devem ser obrigatórios em produção.
- **NFR-003 — Privacidade:** logs não devem conter senha, JWT, refresh token,
  token CSRF completo ou email em claro quando um identificador técnico bastar.
- **NFR-004 — Consistência:** web e API devem usar `/api` no mesmo origin em
  produção; autenticação cross-origin não faz parte do contrato suportado.
- **NFR-005 — Atomicidade:** consumo, rotação e detecção de replay do refresh
  token devem ser atômicos sob requisições concorrentes.
- **NFR-006 — Operação:** rotação de chaves, revogação global e limpeza de
  sessões expiradas devem possuir procedimentos documentados.
- **NFR-007 — Observabilidade:** login, renovação, logout, rate limit e replay
  devem gerar eventos estruturados com resultado e correlação, sem segredos.
- **NFR-008 — Compatibilidade:** a implementação deve estender NestJS/Fastify,
  React, Zod, Drizzle, PostgreSQL e Pino já adotados.
- **NFR-009 — Acessibilidade:** formulário, erros e transições de autenticação
  devem funcionar por teclado, informar estado de carregamento e preservar foco
  de forma previsível.
- **NFR-010 — Disponibilidade:** falha do armazenamento persistido deve negar
  login e renovação de forma segura, sem emitir sessão parcialmente registrada.

## Contratos HTTP propostos

Todos os endpoints ficam sob `/api/auth` no mesmo origin do web.

### `POST /api/auth/login`

- entrada: `{ "email": string, "password": string }`;
- exige `Origin` exato permitido, mas não exige token CSRF de sessão;
- sucesso: `200` com o contrato de sessão
  `{ "authenticated": true, "user": { "id": string, "email": string }, "csrfToken": string }`
  e cookies de access, refresh e CSRF;
- falhas: `400` para formato inválido, `401` para credenciais não aceitas e
  `429` para limite excedido.

### `GET /api/auth/session`

- sucesso: `200` com o mesmo contrato de sessão retornado pelo login;
- falha: `401` para sessão ausente ou inválida.

### `POST /api/auth/refresh`

- exige refresh cookie, `Origin` permitido e token CSRF;
- sucesso: `200` com o mesmo contrato de sessão e rotação dos cookies de access,
  refresh e CSRF;
- falha: `401` e expiração dos cookies para refresh inválido ou replay.

### `DELETE /api/auth/session`

- exige `Origin` permitido; tenta revogar o refresh identificável mesmo quando o
  token CSRF estiver ausente ou inválido;
- retorna `204` de forma idempotente e expira os cookies;
- quando uma família identificável existir, ela deve ser revogada.

O esquema compartilhado deve padronizar erros sem incluir detalhes internos. O
nome final do header CSRF e dos cookies auxiliares deve ser fixado no plano
técnico, sem alterar as garantias desta especificação.

## Ciclo de vida dos dados

- A conta é criada e desativada por processo interno controlado.
- O hash de senha persiste enquanto a conta existir ou até troca administrativa.
- Uma família nasce no login e termina por logout, expiração, revogação,
  desativação da conta ou replay.
- Um refresh token só pode ser consumido uma vez.
- Registros expirados ou revogados devem ser eliminados por rotina idempotente,
  com retenção mínima suficiente para auditoria e investigação; a duração de
  retenção deve ser definida pelo plano operacional.
- A desativação de conta deve revogar todas as suas famílias de refresh.
- Access JWT já emitido pode permanecer válido por no máximo seus 10 minutos;
  revogação imediata do access JWT não faz parte do escopo inicial.

## Critérios de aceite

- **AC-001:** em produção, login válido define `__Host-arcsyn_access` HttpOnly,
  `Secure`, `Path=/`, sem `Domain` e com JWT de 10 minutos; no desenvolvimento
  local por HTTP, define `arcsyn_access` sem `Secure`. Nenhum token de
  autenticação é retornado no corpo.
- **AC-002:** login inválido não define cookies e produz a mesma resposta para
  email inexistente, conta inativa e senha incorreta.
- **AC-003:** senha armazenada nunca é recuperável em claro e não aparece em
  logs, respostas ou eventos.
- **AC-004:** endpoint protegido aceita access JWT válido pelo cookie e rejeita
  ausência, adulteração, expiração, issuer/audience incorretos e algoritmo não
  permitido.
- **AC-005:** um JWT válido enviado como `Bearer`, query parameter ou campo do
  corpo é rejeitado.
- **AC-006:** JavaScript não consegue ler os cookies de access ou refresh.
- **AC-007:** renovação válida consome o refresh atual e emite outro; duas
  renovações concorrentes não produzem duas cadeias válidas.
- **AC-008:** reutilizar refresh já consumido revoga a família e impede novas
  renovações com seus descendentes.
- **AC-009:** `DELETE /api/auth/session` é idempotente, revoga a família
  identificável e remove os cookies com os mesmos nomes por ambiente, path e
  políticas da emissão.
- **AC-010:** login sem `Origin` permitido é rejeitado mesmo sem sessão;
  qualquer outra requisição mutável sem `Origin` permitido é rejeitada. Exceto
  no logout idempotente, as operações mutáveis com sessão também rejeitam token
  CSRF ausente ou inválido, mesmo quando os cookies são válidos.
- **AC-011:** health permanece público, uma rota não marcada retorna `401` sem
  sessão e não existe autorização baseada em roles.
- **AC-012:** Swagger existe em desenvolvimento e não é servido em Preview ou
  Production.
- **AC-013:** MCP retorna indisponível e não é habilitado pela autenticação web.
- **AC-014:** rate limit continua efetivo depois de reinício ou troca de
  instância e retorna `429` sem permitir enumeração de conta.
- **AC-015:** reload de rota protegida restaura a sessão sem expor cookies ao
  web; sessão expirada direciona o usuário para login.
- **AC-016:** falha do PostgreSQL durante login ou refresh não deixa família ou
  cookie parcialmente válidos.
- **AC-017:** logs e respostas de erro de todos os fluxos não contêm JWT,
  refresh token, token CSRF completo, senha ou hash de senha. A única exposição
  intencional do token CSRF é o campo `csrfToken` do contrato de sessão
  autenticada, necessário ao cliente para a proteção double-submit.
- **AC-018:** o proxy entrega `/api` no mesmo origin do web e preserva todos os
  headers `Set-Cookie` requeridos.

## Casos-limite e modos de falha

- refresh simultâneo em duas abas;
- replay após uma rotação legítima;
- cookie duplicado ou sombreado por path/domain;
- relógio desalinhado entre emissor e validador;
- conta desativada com access JWT ainda válido;
- `DELETE /api/auth/session` com cookies ausentes, expirados ou adulterados;
- banco indisponível entre validação da senha e criação da família;
- proxy removendo ou combinando incorretamente `Set-Cookie`;
- requisição de origin ausente, `null` ou não permitido;
- tentativa de open redirect após login;
- JWT ou conjunto de cookies acima do limite de headers;
- limpeza concorrente de sessões enquanto ocorre uma renovação;
- contadores de rate limit indisponíveis ou inconsistentes.

## Observabilidade

Devem existir eventos estruturados para resultado de login, emissão de família,
renovação, logout, revogação, replay, rejeição CSRF e rate limit. Os eventos
devem usar identificadores técnicos, correlação e motivo categorizado. Métricas
devem permitir detectar aumento de `401`, `429`, replay e falhas do PostgreSQL.

## Encaminhamento para segurança

O revisor de segurança deve validar algoritmo e parâmetros de senha, geração e
hash de refresh, comparação em tempo constante, claims, rotação de chaves,
vínculo do CSRF à sessão, política de `Origin`, cookie shadowing, enumeração,
rate limit, replay e exposição de metadados em logs.

## Encaminhamento para QA

O QA deve rastrear cenários até FR/NFR/AC, cobrindo atributos reais dos cookies,
matriz de JWT inválido, concorrência de refresh, replay, CSRF, rate limit entre
instâncias, desativação, indisponibilidade do banco, reload da SPA, Swagger por
ambiente, MCP indisponível e ausência de segredos em respostas/logs.

## Esboço de implementação e responsabilidades

1. **Infraestrutura/DevOps:** implementar e validar o rewrite same-origin de
   `/api` e a persistência do rate limit.
2. **Backend, proprietário dos compartilhados:** definir primeiro contratos em
   `packages/contracts`, configuração em `packages/config`, esquema e migrações
   em `packages/database`.
3. **Backend:** implementar o módulo `auth`, persistência, guard global,
   cookies, JWT, CSRF, rate limit e testes da API.
4. **Frontend:** após estabilização dos contratos, implementar a feature de
   autenticação, bootstrap da sessão, login e proteção das rotas.
5. **Segurança:** revisar antes da integração final.
6. **QA:** validar os critérios após a integração.

Frontend e backend não devem editar `packages/contracts` simultaneamente; o
backend é seu proprietário durante a definição inicial do contrato.

## Fatos confirmados no estado atual

- A API usa NestJS com Fastify e módulos por capacidade.
- O web usa React, React Router e TanStack Query.
- Contratos, configuração e banco já possuem pacotes compartilhados próprios.
- O banco atual não possui usuários nem sessões.
- A API atual não possui autenticação, autorização ou configuração JWT.
- O web usa `VITE_API_URL` quando a API está em outro origin.
- O CORS atual permite o origin do web, mas não habilita credenciais.
- A ADR-0002 exige proxy same-origin antes da autenticação por cookie.
- MCP já permanece desabilitado por padrão em produção.

## Hipóteses conservadoras

- O identificador público de conta é um UUID e não carrega significado de
  negócio.
- O provisionamento interno será definido separadamente e não reutilizará uma
  rota pública de cadastro.
- A revogação imediata do access JWT não é necessária devido ao limite de 10
  minutos; refresh e famílias são revogados imediatamente.
- O token CSRF não é credencial de autenticação e pode ser lido pelo web para
  envio em header.

## Questões de planejamento não bloqueantes

- Definir algoritmo de hash de senha e parâmetros após revisão de segurança.
- Definir algoritmo e estratégia operacional de rotação da chave JWT.
- Fixar o sufixo dos cookies de refresh/CSRF e o nome do header CSRF,
  preservando o prefixo `__Host-` em produção e sua ausência no desenvolvimento
  HTTP.
- Definir dimensões, janelas e retenção dos contadores de rate limit.
- Definir retenção de famílias expiradas/revogadas para auditoria.
- Definir o mecanismo administrativo de provisionamento em especificação
  separada.
