# Especificação: fundação local do Supabase Auth

- **Status:** Em esclarecimento
- **Data:** 2026-08-04
- **Funcionalidade:** identidade e autenticação compartilhadas entre web e MCP
- **ADR relacionada:**
  [ADR-0003](../../docs/architecture/decisions/0003-supabase-auth-bff-web-resource-server-mcp.md)
- **Substitui como direção de produto:** a proposta não integrada da PR #11 de
  JWT e refresh próprios

## Objetivo e valor de negócio

Preparar um ambiente local reproduzível para que o Supabase Auth seja a única
fonte de identidade e o único emissor de tokens de usuário do ArcSyn Shift. A
fundação deve permitir que, em etapas posteriores, a API NestJS funcione como
BFF para a web, com cookies HttpOnly, e como OAuth 2.1 Resource Server para o
transporte MCP.

A mudança elimina a manutenção de hashing de senha, emissão de JWT, famílias de
refresh e provisionamento de identidade implementados pela aplicação na PR #11,
além de permitir que web e agentes MCP representem a mesma pessoa.

## Atores

- **Desenvolvedor:** inicia, reinicia e reseta a stack local, aplica migrações e
  testa os endpoints do Supabase Auth sem depender de um projeto remoto.
- **Usuário da web:** autentica-se no ArcSyn Shift sem receber access ou refresh
  token no JavaScript.
- **Usuário de cliente MCP:** autoriza um cliente OAuth a agir em seu nome e
  acessa o MCP com Bearer token destinado ao recurso correto.
- **Operador da plataforma:** configura projetos, chaves, redirects, clientes,
  limites e rotação, sem expor credenciais administrativas.
- **Administrador de identidade:** cria, suspende, recupera ou remove contas
  pelos fluxos de gestão que ainda precisam ser aprovados.

Não existe ator de workload nesta etapa. Jobs, CI e integrações sem usuário não
receberão identidade, `client_credentials`, service role ou impersonação.

## Dentro do escopo desta fundação

- Supabase CLI fixada como dependência de desenvolvimento e executada pelo pnpm;
- configuração versionada da stack Supabase local, sem segredos reais;
- Supabase Auth, PostgreSQL e serviços mínimos necessários iniciados localmente;
- uma única instância local de PostgreSQL para `auth` e dados da aplicação;
- continuidade do Drizzle como proprietário do esquema de aplicação;
- continuidade do MinIO local sem adotar Supabase Storage nesta mudança;
- configuração validada da API para URL, issuer, JWKS, audience e chave pública
  ou publicável do Supabase;
- comandos reproduzíveis de start, status, stop e reset, com ordem explícita de
  migração e seed;
- usuário de teste local sem dados pessoais reais;
- OAuth/OIDC discovery e JWKS exercitados localmente;
- prova de compatibilidade entre o OAuth Server do Supabase e os requisitos de
  descoberta, `resource` e audience do MCP antes de habilitar `/mcp`.

## Fora do escopo desta fundação

- implementar controllers, guards, cookies ou telas de autenticação;
- copiar ou adaptar o módulo JWT da PR #11;
- consentimento OAuth e registro de clientes prontos para produção;
- autorização por papel, permissão, organização ou ferramenta MCP;
- identidade de workload e grant `client_credentials`;
- migração de usuários existentes, pois não há usuários em `master`;
- provedores sociais, SAML, MFA, passkeys, telefone e login anônimo;
- SMTP e entrega real de email;
- adoção de Supabase Storage, Realtime, Edge Functions ou PostgREST pela
  aplicação;
- decisão entre Supabase Cloud e self-hosting para produção;
- implantação ou alteração de ambientes externos.

## Jornadas

### Desenvolvedor prepara o ambiente

1. Instala as dependências com pnpm.
2. Inicia a stack Supabase local por comando versionado do repositório.
3. Aplica as migrações Drizzle do esquema de aplicação na mesma instância
   PostgreSQL que contém o esquema `auth` administrado pelo Supabase.
4. Carrega seed local idempotente, sem credencial real.
5. Inicia API e web e consulta health, Auth discovery, JWKS e o usuário local.

### Usuário da web, etapa posterior

1. Envia credenciais ou inicia outro método aprovado somente para a API NestJS.
2. O BFF troca dados com Supabase Auth e mantém access e refresh tokens apenas
   em cookies HttpOnly.
3. O navegador restaura, renova e encerra a sessão por contratos `/api/auth/*`;
   não acessa diretamente a sessão Supabase.

### Usuário de cliente MCP, etapa posterior

1. O cliente acessa `/mcp` sem credencial e recebe `401` com a localização do
   Protected Resource Metadata.
2. Descobre o Supabase Auth, executa Authorization Code com PKCE e apresenta ao
   usuário a tela de consentimento do ArcSyn Shift.
3. Envia o access token em `Authorization: Bearer` a cada requisição MCP.
4. A API valida assinatura, issuer, audience, expiração, subject e vínculo com o
   cliente antes de executar uma ferramenta.

## Requisitos funcionais

- **FR-001:** o repositório deve fixar Supabase CLI em versão compatível com o
  OAuth Server local, no mínimo 2.54.11, como dependência de desenvolvimento e
  invocá-la por pnpm.
- **FR-002:** a configuração local deve ser mantida em `supabase/config.toml` e
  deve habilitar Supabase Auth com `site_url` e redirects locais explícitos.
- **FR-003:** segredos referenciados pela configuração devem vir de variáveis de
  ambiente ignoradas pelo Git; exemplos devem usar apenas placeholders ou
  credenciais locais não sensíveis documentadas como tal.
- **FR-004:** Supabase local deve ser proprietário da instância PostgreSQL que
  contém o esquema reservado `auth`; não deve existir um segundo banco local
  independente para os dados usados pela API.
- **FR-005:** `packages/database` e Drizzle devem continuar proprietários das
  tabelas de aplicação fora dos esquemas reservados do Supabase e não devem
  alterar diretamente tabelas internas de `auth`.
- **FR-006:** o reset local deve recriar a stack, reaplicar migrações de
  aplicação e seed na ordem documentada, sem depender de passos manuais no
  Studio.
- **FR-007:** o PostgreSQL atual do `docker-compose.yml` deve ser retirado do
  caminho principal local quando o Supabase for adotado, enquanto MinIO pode
  permanecer no Compose até decisão específica de storage.
- **FR-008:** a API deve receber configuração validada e separada para URL do
  Supabase, issuer esperado, URL de JWKS, audience aceita, identificador
  canônico do MCP e chave publicável necessária às chamadas de Auth.
- **FR-009:** a configuração administrativa do Supabase não deve ser exigida no
  runtime comum da web nem enviada ao navegador; eventual secret/service role
  deve existir somente em adaptador administrativo autorizado.
- **FR-010:** o ambiente local deve oferecer um usuário determinístico de teste,
  sem email ou senha reais, criado por seed ou comando idempotente.
- **FR-011:** o ambiente deve expor discovery OAuth/OIDC e JWKS e usar chave de
  assinatura assimétrica antes de considerar o fluxo MCP validado.
- **FR-012:** a preparação deve executar uma prova do Authorization Code com
  PKCE que verifique como o Supabase local trata `resource`, audience e
  `client_id`; resultado incompatível deve manter MCP desabilitado.
- **FR-013:** Supabase Auth deve ser a única fonte de contas, identidades,
  credenciais, sessões e refresh tokens de usuário; a aplicação não deve criar
  tabelas equivalentes nem assinar tokens próprios.
- **FR-014:** o identificador estável do principal da aplicação deve ser o `sub`
  emitido pelo Supabase; email e metadados mutáveis não devem ser usados como
  chave de negócio.
- **FR-015:** no contrato alvo da web, a API NestJS deve ser o único BFF e deve
  aceitar credenciais de sessão do navegador somente pelos cookies oficiais
  HttpOnly.
- **FR-016:** access e refresh token da sessão web não devem aparecer no corpo,
  URL, armazenamento acessível ao JavaScript, logs ou telemetria.
- **FR-017:** mutações autenticadas por cookie devem validar `Origin` e proteção
  CSRF; `SameSite` não deve ser a única proteção.
- **FR-018:** respostas que criam ou renovam cookies de sessão devem impedir
  cache compartilhado e proxies devem preservar separadamente `Set-Cookie`.
- **FR-019:** o adaptador MCP deve aceitar access token somente em
  `Authorization: Bearer`, nunca em cookie, URL ou corpo.
- **FR-020:** guards de web e MCP devem ser distintos e impedir confusão de
  credenciais: cookie web não autentica MCP e Bearer MCP não autentica rotas
  BFF.
- **FR-021:** o Resource Server MCP deve publicar Protected Resource Metadata,
  responder desafios `WWW-Authenticate` e apontar para o issuer Supabase.
- **FR-022:** a validação MCP deve exigir assinatura por JWKS, algoritmo
  permitido, `iss`, `aud`, `sub`, `iat`, `exp`, `client_id` quando aplicável e
  token destinado ao URI canônico do MCP.
- **FR-023:** cada requisição MCP deve carregar Bearer token; sessão de
  transporte não deve substituir autenticação.
- **FR-024:** nenhum fluxo desta etapa deve emitir identidade de workload,
  aceitar `client_credentials`, reutilizar service role como identidade ou
  permitir atuação sem uma pessoa identificada.
- **FR-025:** health deve permanecer público; demais rotas devem adotar
  autenticação por padrão e allowlist pública explícita quando a implementação
  de autenticação for ativada.
- **FR-026:** eventos de login, refresh, logout, consentimento, revogação e
  rejeição de token devem ser categorizados e correlacionáveis, sem tokens,
  senhas, chaves ou email completo.
- **FR-027:** o conteúdo público de saúde atualmente servido em `/` deve ser
  movido sem perda funcional para `/status`.
- **FR-028:** `/` deve exigir uma sessão web válida; durante a verificação não
  deve renderizar conteúdo protegido, `401` deve redirecionar para `/login` e
  indisponibilidade de Auth deve exibir erro recuperável, não simular logout.
- **FR-029:** `/login` deve autenticar por email e senha exclusivamente pelo BFF
  same-origin, sem receber, armazenar ou inspecionar tokens Supabase no
  JavaScript.
- **FR-030:** redirecionamento após login deve aceitar somente destinos internos
  reconhecidos; URLs absolutas, protocol-relative ou malformadas devem cair em
  `/`.
- **FR-031:** a página de login deve usar o Design System ArcSyn, tema dark e
  IBM Plex Sans. Em telas amplas, a composição deve reservar 60% para hero com
  apresentação do sistema e marca ArcSyn e 40% para o formulário; em mobile, o
  formulário é prioritário e o hero deve ser condensado sem perda de contexto.

## Requisitos não funcionais

- **NFR-001 — Reprodutibilidade:** um clone limpo com Node.js 20+, pnpm e Docker
  deve obter o mesmo ambiente por comandos versionados.
- **NFR-002 — Segurança local:** a stack local, sem TLS, rate limit de produção
  e com credenciais de desenvolvimento, deve escutar apenas interfaces locais e
  nunca ser apresentada como adequada à produção.
- **NFR-003 — Isolamento:** desenvolvimento, Preview e Production devem usar
  projetos, chaves, redirects e clientes OAuth separados.
- **NFR-004 — Disponibilidade segura:** indisponibilidade do Supabase Auth ou de
  JWKS deve negar novas autenticações; cache de JWKS pode validar tokens dentro
  de política limitada e observável.
- **NFR-005 — Rotação:** cache e rotação de JWKS devem aceitar sobreposição
  controlada sem cache indefinido nem compartilhamento de segredo simétrico.
- **NFR-006 — Privacidade:** senha, access token, refresh token, authorization
  code, PKCE verifier, secret/service role e cookies não podem aparecer em logs,
  erros, fixtures ou telemetria.
- **NFR-007 — Compatibilidade:** a solução deve preservar NestJS/Fastify, React,
  Zod, Drizzle, PostgreSQL, Pino, pnpm e Turborepo existentes.
- **NFR-008 — Portabilidade:** domínio não deve depender de tipos do SDK
  Supabase; o provedor deve ficar atrás de portas de aplicação e adaptadores.
- **NFR-009 — Operação:** startup, reset, atualização da CLI, rotação de chaves,
  revogação de usuário e indisponibilidade devem possuir procedimentos
  documentáveis e testáveis.
- **NFR-010 — Acessibilidade:** login e consentimento futuros devem funcionar
  por teclado, anunciar erros e decisões, preservar foco e não depender somente
  de cor.
- **NFR-011 — Evolução controlada:** a dependência beta do OAuth Server não pode
  ser promovida a produção sem gate de compatibilidade e estratégia de saída.
- **NFR-012 — Mobile first:** toda jornada web deve ser projetada e implementada
  primeiro para viewports móveis, com aprimoramento progressivo para telas
  maiores, sem rolagem horizontal acidental e sem perda de conteúdo, ações,
  ordem semântica, foco ou usabilidade por toque.

## Critérios de aceite da fundação local

- **AC-001:** após instalação em clone limpo, o comando documentado inicia a
  versão fixada da CLI e `supabase status` informa Auth, banco e Studio locais
  saudáveis.
- **AC-002:** nenhum arquivo versionado contém access token pessoal, senha real,
  secret key, service role, JWT secret ou credencial de provedor social.
- **AC-003:** API e migrações conectam-se ao PostgreSQL da stack Supabase; não
  há dois bancos locais contendo versões divergentes do esquema da aplicação.
- **AC-004:** as migrações Drizzle criam `system_health` fora de `auth` e um
  reset completo volta ao mesmo estado sem edição manual no Studio.
- **AC-005:** o schema `auth` permanece administrado pelo Supabase, e
  `packages/database` não exporta nem migra suas tabelas internas.
- **AC-006:** o usuário de teste pode ser recriado idempotentemente, autenticar
  no Auth local e não contém dado pessoal real.
- **AC-007:** endpoints de discovery e JWKS respondem localmente com issuer e
  algoritmo esperados; a chave privada não é exposta.
- **AC-008:** desligar Auth faz login e refresh falharem de forma explícita e
  segura, sem fallback para JWT próprio.
- **AC-009:** MinIO continua inicializável sem exigir que o PostgreSQL legado do
  Compose seja a fonte de dados da API.
- **AC-010:** a prova MCP registra versão da CLI/Auth, request com `resource`,
  claims do token sanitizadas e resultado da validação de audience; falha mantém
  `MCP_ENABLED=false` fora de teste controlado.

## Critérios de aceite da arquitetura alvo

- **AC-011:** login web bem-sucedido retorna somente dados públicos do principal
  e define access/refresh em cookies HttpOnly; o bundle e o JavaScript não
  conseguem ler os tokens.
- **AC-012:** sessão web ausente, adulterada ou expirada retorna `401`; Bearer
  válido no lugar do cookie não autentica uma rota BFF.
- **AC-013:** mutação com cookie válido e `Origin` ou CSRF inválido é rejeitada.
- **AC-014:** logout é idempotente, revoga a sessão/refresh no Supabase e remove
  cookies com atributos compatíveis com a emissão.
- **AC-015:** resposta de refresh usa `Cache-Control: private, no-store` ou
  garantia equivalente e seus `Set-Cookie` não são reutilizados para outro
  usuário.
- **AC-016:** `/mcp` sem Bearer retorna `401` e `WWW-Authenticate` com
  `resource_metadata`; o documento indica o issuer e o URI canônico corretos.
- **AC-017:** MCP rejeita cookie web, Bearer em query, token de outro issuer,
  audience ou recurso, token expirado, algoritmo não permitido e `client_id` não
  aceito.
- **AC-018:** fluxo MCP Authorization Code com PKCE exige consentimento humano e
  não oferece `client_credentials` nem service role ao cliente.
- **AC-019:** suspensão ou remoção de usuário bloqueia novos logins e refresh; a
  janela residual de access token segue a política aprovada e observável.
- **AC-020:** logs e respostas não contêm os segredos listados no NFR-006 em
  login, refresh, consentimento, MCP válido ou falhas.
- **AC-021:** login, restauração de sessão, logout e consentimento funcionam no
  menor viewport suportado sem corte ou rolagem horizontal acidental; ações
  permanecem alcançáveis por toque e teclado, e a expansão para tablet/desktop
  não altera a hierarquia semântica nem oculta funcionalidade.
- **AC-022:** `/status` permanece público e apresenta o mesmo estado de saúde
  anteriormente disponível em `/`.
- **AC-023:** acesso anônimo a `/` aguarda a consulta de sessão e redireciona
  para `/login`; uma sessão válida permite a página protegida, enquanto falha
  `5xx` apresenta retry sem apagar a sessão por inferência.
- **AC-024:** credenciais válidas em `/login` criam cookies HttpOnly pelo BFF e
  levam ao destino interno preservado; erro de credenciais mantém o formulário,
  não enumera conta e move foco/anúncio para uma mensagem acessível.
- **AC-025:** em viewport desktop, a página de login mantém proporção visual
  60/40 entre hero e formulário; em 320 CSS px não há rolagem horizontal, o
  formulário aparece antes de conteúdo decorativo e todos os controles são
  operáveis por toque e teclado.
- **AC-026:** `/login` não contém token em DOM, Web Storage, URL ou respostas
  acessíveis ao frontend; destinos externos em `next` são rejeitados.

## Casos-limite e modos de falha

- portas padrão do Supabase ocupadas ou conflito com o PostgreSQL legado;
- CLI atualizada sem atualização compatível das imagens locais;
- `supabase db reset` executado sem reaplicar migrações Drizzle;
- Supabase saudável, mas API apontando para banco ou issuer antigo;
- seed duplicando usuário ou alterando senha de forma não intencional;
- chave de assinatura simétrica sem JWKS público apropriado;
- rotação de chave enquanto a API mantém JWKS em cache;
- Auth indisponível durante refresh, logout ou consentimento;
- duas renovações simultâneas da mesma sessão web;
- proxy/CDN armazenando resposta com `Set-Cookie`;
- cookie duplicado, sombreado ou não removido devido a path/domain diferentes;
- token regular da web apresentado ao MCP;
- token OAuth MCP com `aud=authenticated`, mas sem vínculo ao recurso MCP;
- Supabase rejeitar, ignorar ou não refletir o parâmetro `resource`;
- cliente dinâmico malicioso registrar redirect URI ou nome enganoso;
- usuário aprovar scopes OIDC supondo que limitam ferramentas, embora os scopes
  atuais do Supabase não concedam autorização de negócio;
- conta suspensa com access token ainda válido;
- identidade removida enquanto dados de domínio ainda a referenciam;
- uso acidental de service role contornando RLS ou impersonando usuário;
- request MCP sem token em uma conexão de transporte previamente autenticada.

## Impactos em dados, APIs, eventos e integrações

### Dados

- `auth.users`, identidades, sessões, refresh tokens, clientes OAuth e grants
  passam a ser propriedade do Supabase e não do Drizzle.
- tabelas de domínio continuam em `packages/database`; referências a pessoas
  usarão o UUID de `sub`, mas política de FK e deleção ainda precisa de decisão.
- a instância PostgreSQL local do Supabase substitui o container PostgreSQL
  atual no caminho principal de desenvolvimento.

### APIs

- alvo web: contratos BFF `/api/auth/*`, sem exposição da API Supabase ao
  navegador como fronteira de sessão;
- alvo MCP: `/mcp` como Resource Server, Protected Resource Metadata público e
  Bearer obrigatório;
- Supabase Auth expõe endpoints de login/refresh/logout, OAuth/OIDC discovery,
  authorization, token, userinfo e JWKS; a API não deve reimplementar esses
  protocolos.

### Eventos e observabilidade

- eventos de autenticação e autorização precisam combinar correlação da API com
  logs/auditoria disponíveis no Supabase, sem duplicar tokens ou PII;
- não há fila ou evento assíncrono novo nesta fundação.

### Integrações

- nova integração estrutural com Supabase CLI/Auth;
- Docker permanece requisito local; MinIO continua independente;
- produção Supabase Cloud versus self-hosted permanece em aberto.

## Encaminhamento para segurança

Validar especialmente: beta do OAuth Server; PKCE; consentimento; redirects;
registro dinâmico; `resource`/audience; algoritmo e JWKS; cache e rotação;
confusão cookie/Bearer; CSRF; cache de respostas; armazenamento de refresh;
service role; suspensão e revogação; exposição de PII; rate limits; e fronteira
entre schemas `auth` e aplicação.

## Encaminhamento para QA

Criar matriz rastreável de clone/start/reset, portas, migrações, seed,
discovery, JWKS e indisponibilidade. Para as etapas seguintes, cobrir cookies
reais, refresh concorrente, CSRF, cache, logout, claims inválidas, Protected
Resource Metadata, Authorization Code com PKCE, consentimento,
audience/resource, separação web/MCP e ausência de segredos.

## Esboço de implementação e responsabilidades

1. **DevOps, proprietário de `supabase/**`, scripts raiz e infraestrutura:**
   fixar CLI, configurar stack, retirar o PostgreSQL duplicado do caminho local,
   preservar MinIO e documentar start/reset.
2. **Backend, proprietário de `packages/config` e `packages/database`:** apontar
   Drizzle ao banco Supabase, preservar propriedade do schema de aplicação,
   definir variáveis validadas e seed técnico.
3. **Backend, proprietário de `packages/contracts`:** definir contratos BFF e
   erros antes que frontend os consuma.
4. **Backend:** implementar posteriormente adaptador Supabase, BFF, cookies,
   guards separados, Protected Resource Metadata e validação JWKS.
5. **Frontend:** somente após contratos estabilizados, implementar login,
   restauração e consentimento com abordagem mobile first, sem importar
   credenciais administrativas nem acessar tokens.
6. **Segurança:** revisar a prova MCP e a fronteira de cookies antes de
   habilitar autenticação.
7. **QA:** validar AC-001 a AC-010 na fundação e AC-011 a AC-026 nas fases de
   produto correspondentes.

`packages/config`, `packages/database` e `packages/contracts` devem ter um único
proprietário por etapa. Frontend e backend não devem editá-los simultaneamente.

## Fatos confirmados

- `master` não possui autenticação, usuários nem sessões.
- a PR #11 está representada pela branch `codex/autenticacao-jwt-http-only` e
  adiciona JWT, refresh, cookies e tabelas próprios; ela ainda não integra
  `master`.
- a API usa NestJS/Fastify, web usa React/Vite, contratos/configuração/banco são
  pacotes compartilhados, e Drizzle migra o schema de aplicação.
- o ambiente atual usa PostgreSQL 16 em Docker Compose na porta 5433 e MinIO em
  containers separados.
- MCP é um controller HTTP simples em `/mcp`, pode ser desabilitado e ainda não
  implementa autenticação nem descoberta OAuth.
- Supabase CLI executa a stack local completa, exige Docker e usa
  `supabase/config.toml` versionável.
- em 2026-08-04, o OAuth 2.1 Server do Supabase está em beta e requer CLI
  2.54.11 ou superior para desenvolvimento local.
- o OAuth Server suporta Authorization Code com PKCE e refresh, não suporta
  `client_credentials`, e seus scopes atuais são de identidade OIDC, não de
  autorização da aplicação.
- o MCP vigente exige Protected Resource Metadata, Bearer em cada request,
  Resource Indicators e validação de token destinado ao recurso.

## Hipóteses conservadoras

- a fundação local começará com email e senha e signup público desabilitado,
  apenas para validar infraestrutura; isso não decide os métodos finais.
- o banco Supabase local substituirá o PostgreSQL do Compose, evitando duas
  fontes de dados; MinIO permanecerá.
- Drizzle continuará como ferramenta de migração do domínio, com um comando
  composto após start/reset do Supabase.
- o MCP permanecerá desabilitado fora da prova até compatibilidade com
  `resource` e audience ser demonstrada.
- o identificador do usuário será `sub`; nenhum perfil de domínio será criado
  até existir requisito de produto.

## Questões em aberto

- **OQ-001 — bloqueante para produção:** a equipe aceita depender do OAuth
  Server beta do Supabase? Qual é o prazo e a alternativa de saída se a API
  mudar?
- **OQ-002 — bloqueante para MCP:** o Supabase aceita e vincula o parâmetro
  `resource` exigido pelo MCP e emite audience verificável para o URI canônico?
  Se não, será aprovado um Custom Access Token Hook, outro Authorization Server
  ou o adiamento do MCP autenticado?
- **OQ-003 — escopo de identidade:** “Supabase Auth completo” inclui quais
  métodos e jornadas: signup, convite, confirmação de email, recuperação, magic
  link, provedores sociais, MFA, passkey e administração?
- **OQ-004 — autorização:** quais permissões cada usuário e cliente MCP possui?
  Scopes OIDC do Supabase não limitam ferramentas ou dados de negócio.
- **OQ-005 — consentimento:** registro de clientes será apenas pré-aprovado ou
  dinâmico? Quem pode revogar grants e como clientes serão exibidos ao usuário?
- **OQ-006 — produção:** será usado Supabase Cloud ou self-hosting? Região,
  residência de dados, disponibilidade, backup, RTO/RPO e custos não estão
  definidos.
- **OQ-007 — ciclo de conta:** quem pode criar, suspender e excluir usuários e
  qual efeito deve ocorrer nos dados de domínio e access tokens já emitidos?
- **OQ-008 — sessão web:** duração de access/refresh, política de single
  session, logout local/global e tolerância a refresh concorrente precisam ser
  fixadas.
- **OQ-009 — cookies:** nomes, `SameSite`, domínio e estratégia para Preview
  dependem do domínio/proxy same-origin final.
- **OQ-010 — migrações:** confirma-se Drizzle separado de `supabase/migrations`,
  com comando composto, ou a equipe quer uma única trilha de migração sob a CLI?
- **OQ-011 — SDK:** a API usará `@supabase/supabase-js`, chamadas HTTP ao Auth
  ou um adaptador menor? A decisão depende de isolamento de sessão, superfície e
  manutenção.
- **OQ-012 — rate limit e auditoria:** limites, retenção e alertas necessários
  para web, OAuth, registro de cliente e MCP ainda não foram definidos.

## Referências de validação

O spike local executado em 2026-08-05 confirmou discovery, JWKS ES256,
Authorization Code, PKCE S256, login e refresh. Também confirmou que o Supabase
Auth 2.194.0 não vinculou o parâmetro `resource` ao access token: a audience
emitida permaneceu `authenticated`. AC-010, portanto, mantém o MCP da aplicação
desabilitado até a definição de um Custom Access Token Hook ou outra estratégia
de audience.

- [Supabase CLI e ambiente local](https://supabase.com/docs/guides/local-development/cli/getting-started)
- [OAuth 2.1 Server do Supabase](https://supabase.com/docs/guides/auth/oauth-server/getting-started)
- [Fluxos e limitações de scopes](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows)
- [Validação de JWT e JWKS](https://supabase.com/docs/guides/auth/jwts)
- [Autenticação MCP com Supabase](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication)
- [Autorização MCP vigente](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
