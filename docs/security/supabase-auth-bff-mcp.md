# Revisão de segurança: Supabase Auth, BFF web e OAuth no MCP

- **Data da revisão:** 2026-08-04
- **Tipo:** revisão pré-implementação e modelo de ameaças
- **Estado avaliado:** preparação local, sem workload protegido implementado
- **Confiança geral:** alta para o baseline do repositório; média para a
  integração futura, que permanece descrita como proposta na especificação e na
  ADR-0003

## 1. Resumo executivo

Não existe implementação de Supabase Auth na branch avaliada. O baseline atual
possui um MCP próprio que, quando habilitado, aceita chamadas sem autenticação e
a API escuta em todas as interfaces. O impacto presente é baixo porque a única
ferramenta disponível é `health_check`, mas esse comportamento não pode ser
herdado pela implementação futura.

A preparação pode avançar somente depois de resolver estes gates:

1. isolar a stack Supabase local da rede externa e não reutilizar credenciais
   locais em qualquer ambiente remoto;
2. aprovar a arquitetura que torna Supabase Auth o Authorization Server OAuth
   2.1 e a API NestJS o Resource Server do MCP;
3. definir um token MCP com `aud` ligado ao URI canônico do recurso e rejeitar
   tokens de sessão web ou de outro cliente;
4. definir autorização negativa por padrão para ferramenta, operação, objeto e
   tenant, independente dos scopes OIDC do Supabase;
5. fechar o contrato de cookies, CSRF, PKCE, rotação e expiração da sessão BFF;
6. manter segredos fora do Git, do bundle Vite, de logs e de imagens;
7. comprovar por testes de interoperabilidade que descoberta, `resource`, PKCE,
   audience e erros `401`/`403` atendem à especificação MCP adotada.

O OAuth 2.1 Server do Supabase está em beta na documentação consultada. Essa
dependência estrutural e o uso de um Custom Access Token Hook para `aud` exigem
análise do `requirements_architect` e ADR antes da implementação.

## 2. Escopo analisado

Foram inspecionados:

- `AGENTS.md`, princípios, visão e stack arquitetural, fluxo de especificações,
  convenções e verificações;
- ADR-0002 e o runbook de Vercel;
- bootstrap NestJS/Fastify, composição e contrato atual do MCP;
- validação de configuração e exemplos de ambiente;
- `docker-compose.yml`, `.gitignore`, manifests, lockfile e CI;
- arquivos rastreados por Git e busca por padrões de segredo, sem ler nem
  divulgar valores do `.env` local;
- documentação oficial atual do Supabase, MCP e RFCs aplicáveis.

O `git diff` estava vazio no início da revisão. Durante a revisão, outro agente
adicionou concorrentemente a preparação em `supabase/`, exemplos de ambiente e o
pin `supabase@2.111.0`; esse diff emergente também foi inspecionado. Ao final,
foram adicionadas concorrentemente a especificação
`specs/supabase-auth-local/spec.md` (status **Em esclarecimento**) e a ADR-0003
(status **Proposta**), que passaram a integrar o escopo. Arquivos de
autenticação observados em uma listagem inicial desapareceram por mudança
concorrente de branch/árvore antes de poderem ser lidos; não foram restaurados
nem considerados fonte vigente.

## 3. Ativos, atores, pontos de entrada e limites de confiança

### Ativos

- identidade do usuário (`sub`), vínculo com perfil, tenant, papéis e
  permissões;
- access tokens, refresh tokens, authorization codes, PKCE verifier, cookies e
  dados de sessão;
- chaves privadas de assinatura, segredos OAuth, `service_role`/secret key,
  credenciais do banco e tokens da CLI;
- dados e operações expostos pelas futuras ferramentas MCP;
- trilha de auditoria de login, consentimento, refresh, revogação e chamadas de
  ferramenta.

### Atores

- usuário legítimo no navegador;
- cliente MCP público ou confidencial agindo em nome do usuário;
- API NestJS/BFF e Resource Server MCP;
- Supabase Auth como Identity Provider e Authorization Server;
- administrador do projeto Supabase e operador de ambientes;
- atacante remoto, site malicioso, extensão/browser comprometido, cliente MCP
  malicioso e usuário autenticado tentando acessar outro objeto ou tenant.

### Pontos de entrada

- endpoints BFF de login, callback, sessão, refresh, logout e recuperação;
- cookies enviados automaticamente pelo navegador;
- `GET`/`POST /mcp` e futuros transportes MCP;
- `/.well-known/oauth-protected-resource[/mcp]` e descoberta do Authorization
  Server;
- endpoints Supabase de autorização, token, JWKS, cadastro e recuperação;
- tela de consentimento OAuth e eventual Dynamic Client Registration;
- variáveis de ambiente, `supabase/config.toml`, migrations e seed local.

### Limites de confiança

1. navegador não confiável -> BFF NestJS;
2. site de terceiro -> navegador com cookies do ArcSyn Shift;
3. cliente MCP não confiável -> Resource Server MCP;
4. API -> Supabase Auth/JWKS;
5. access token validado -> contexto de autorização da aplicação;
6. aplicação/API -> PostgreSQL e dados por tenant;
7. host local -> contêineres Supabase com credenciais de desenvolvimento;
8. repositório/CI -> secret stores locais e dos ambientes remotos.

Cookies web não cruzam para o protocolo MCP. Tokens bearer MCP não devem ser
aceitos como cookies web nem repassados a serviços a jusante.

## 4. Modelo de ameaças e casos de abuso

| Caso | Pré-condição                                    | Abuso e impacto                                                        | Controle exigido                                                         |
| ---- | ----------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| T-01 | Stack local acessível fora do host              | Atacante alcança serviços sem TLS, rate limit e com credenciais padrão | Bind em loopback, firewall e proibição explícita de exposição            |
| T-02 | Resource Server valida apenas assinatura/issuer | Token web ou de outro cliente é usado no MCP                           | `aud` exato para o URI canônico, `resource` e separação de tokens        |
| T-03 | Cookie autentica mutações sem defesa CSRF       | Site malicioso cria/edita dados em nome do usuário                     | Same-origin, `SameSite`, validação de `Origin` e token CSRF              |
| T-04 | Callback aceita estado/redirect frouxo          | Login CSRF, session swapping ou open redirect                          | PKCE S256, `state` de uso único e redirect exato                         |
| T-05 | Refresh concorrente ou cliente global           | Revogação involuntária ou sessão de um usuário usada por outro         | Cliente por request, coordenação de refresh e `no-store`                 |
| T-06 | Autenticação tratada como autorização           | Usuário chama ferramenta privilegiada ou objeto de outro tenant        | policy por ferramenta/operação/objeto/tenant, deny by default            |
| T-07 | DCR e consentimento sem controle                | Cadastro abusivo, phishing de consentimento ou scopes excessivos       | Decisão explícita sobre DCR, rate limit, consentimento e revogação       |
| T-08 | Segredo entra em exemplo, log ou bundle         | Comprometimento do Auth, banco ou todos os usuários                    | classificação, secret store, redaction, scan e rotação                   |
| T-09 | JWKS/algoritmo aceito sem restrição             | Token forjado, chave errada ou falha durante rotação                   | ES256/RS256 aprovado, allowlist de `alg`, `kid`, cache e refresh seguros |
| T-10 | Resposta autenticada ou `Set-Cookie` é cacheada | Vazamento ou troca de sessão entre usuários                            | `Cache-Control: private, no-store` e verificação no CDN                  |
| T-11 | Rate limit ausente                              | Password spraying, enumeração, DCR spam ou custo por ferramentas       | limites por IP, usuário, cliente e ferramenta; respostas uniformes       |
| T-12 | Logout é tratado como revogação imediata do JWT | Token MCP roubado continua válido até `exp`                            | access token curto, revogação onde necessária e risco documentado        |

## 5. Achados ordenados por severidade

### Vulnerabilidade confirmada

#### SEC-001 — MCP local sem autenticação quando habilitado

- **Severidade:** Baixo
- **Confiança:** alta
- **Localização:** `apps/api/src/main.ts:21-30`,
  `apps/api/src/infrastructure/mcp/mcp.controller.ts:4-20`, `.env.example:7`
- **Evidência:** a API escuta em `0.0.0.0`; o MCP é excluído do prefixo `/api` e
  possui `GET` e `POST` sem guard. A preparação mitigou a exposição imediata
  mantendo `MCP_ENABLED=false` nos exemplos, conforme AC-010. CORS permite
  somente o web no navegador, mas não é autenticação e não bloqueará clientes
  HTTP diretos se o MCP for ligado antes do guard OAuth.
- **Cenário de abuso:** com a API local iniciada e a porta alcançável na rede,
  qualquer cliente lista e chama ferramentas sem credencial.
- **Pré-condições:** `MCP_ENABLED=true`, porta alcançável e processo local em
  execução.
- **Impacto:** hoje expõe apenas metadados e `health_check`; o impacto se torna
  material assim que uma ferramenta com dados ou efeitos for registrada.
- **Recomendação:** manter o MCP desabilitado por padrão; restringir o bind
  local a loopback ou firewall; depois da implementação, negar toda chamada sem
  bearer token válido e autorização por ferramenta.
- **Teste da correção:** de outro host/container, a conexão local deve falhar;
  no host, `/mcp` deve retornar `404` quando desabilitado e `401` com
  `WWW-Authenticate` quando habilitado sem token.

### Riscos de projeto

#### SEC-002 — Confusão de audiência entre sessão web e token MCP

- **Severidade:** Alto
- **Confiança:** alta
- **Localização:** desenho proposto; ausência de configuração Auth/OAuth em
  `packages/config/src/index.ts:5-14`; MCP atual em
  `apps/api/src/infrastructure/mcp/mcp.controller.ts:13-19`
- **Evidência:** o Resource Server ainda não valida token. A documentação
  oficial do Supabase mostra `aud: "authenticated"` como padrão do access token
  OAuth e orienta Custom Access Token Hook para personalizar `aud`. A
  especificação MCP exige token emitido para o Resource Server e proíbe token
  passthrough.
- **Cenário de abuso:** um atacante obtém um JWT Supabase válido para o web ou
  outro OAuth client; se a futura validação verificar apenas assinatura, `iss` e
  `exp`, ele invoca o MCP como se o token fosse destinado a ele.
- **Pré-condições:** mesmo issuer/chave e ausência de validação estrita de `aud`
  e tipo/cliente do token.
- **Impacto:** acesso indevido a todas as ferramentas autorizadas apenas por
  identidade, com possibilidade de exfiltração ou alteração de dados.
- **Recomendação:** definir um URI canônico único, por exemplo o origin e path
  público final do MCP; emitir access tokens OAuth MCP com `aud` exatamente
  igual a esse URI; validar assinatura, allowlist de `alg`, `kid`, `iss`, `aud`,
  `exp`, `nbf` quando presente, `sub`, `client_id` e claims de autorização.
  Rejeitar ID tokens, tokens web e tokens sem audience específica. Nunca
  encaminhar o bearer recebido ao banco ou API a jusante.
- **Teste da correção:** matriz negativa com token web, ID token, audience
  ausente, audience diferente, issuer diferente, `alg` diferente, expirado e
  assinatura inválida; todos devem resultar em `401`. O token MCP correto deve
  passar, e `resource` deve estar presente nos requests de autorização e token.

#### SEC-003 — Contrato BFF de cookies e CSRF não definido

- **Severidade:** Alto
- **Confiança:** alta
- **Localização:** desenho proposto; origins separados reconhecidos na
  ADR-0002:45-46 e proxy same-origin pendente na ADR-0002:68
- **Evidência:** não há endpoints nem atributos de cookie especificados. Um
  cookie `HttpOnly` impede leitura por JavaScript, mas continua sendo enviado
  automaticamente e, sozinho, não evita CSRF. O callback OAuth também cria um
  limite de confiança para código, estado e redirect.
- **Cenário de abuso:** um site malicioso submete mutação autenticada; ou um
  atacante inicia login e faz a vítima concluir o fluxo, trocando a sessão
  esperada.
- **Pré-condições:** cookies aceitos em request cross-site, mutação sem
  validação de origem/CSRF, ou callback sem estado de uso único e PKCE.
- **Impacto:** operações em nome da vítima, session fixation/swapping e tomada
  de conta conforme os endpoints disponíveis.
- **Recomendação:** preferir proxy same-origin antes de Auth. Em produção, usar
  cookies `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, sem `Domain` e, quando
  compatível, prefixo `__Host-`; separar nomes de access e refresh e limitar o
  refresh ao menor path operacional possível. Exigir método não-GET, content
  type esperado, allowlist exata de `Origin`/`Referer` e token CSRF nas
  mutações. Usar PKCE S256, `state` aleatório vinculado ao navegador e de uso
  único, redirects exatos e rotação/limpeza completa no login/logout.
- **Teste da correção:** requests cross-origin, sem/mau `Origin`, sem token
  CSRF, `state` ausente/reutilizado e redirect não registrado devem falhar;
  inspecionar `Set-Cookie` e confirmar que JavaScript não lê os cookies.

#### SEC-004 — Autorização MCP por ferramenta, operação, objeto e tenant ausente

- **Severidade:** Alto
- **Confiança:** alta
- **Localização:** `apps/api/src/infrastructure/mcp/mcp-server.ts:8-19`,
  `docs/architecture/decisions/0002-implantacao-vercel-sem-worker.md:28-29`
- **Evidência:** `McpServer.callTool` recebe somente o nome e não possui
  principal/contexto de autorização. A ADR exige autorização por ferramenta
  antes de habilitar MCP. Os scopes OIDC padrão do Supabase controlam dados de
  identidade e não autorização de tabelas ou endpoints.
- **Cenário de abuso:** um usuário autenticado chama ferramenta administrativa,
  muda o identificador de um objeto ou acessa outro tenant.
- **Pré-condições:** token válido, ferramenta registrada e autorização aplicada
  apenas na rota ou baseada em parâmetros fornecidos pelo cliente.
- **Impacto:** BOLA/IDOR, elevação de privilégio, alteração e exfiltração.
- **Recomendação:** propagar um principal imutável até os casos de uso; mapear
  cada ferramenta e operação a permissões; resolver tenant e ownership no
  servidor; consultar estado autoritativo quando a claim puder estar obsoleta;
  negar por padrão. `user_metadata` editável pelo usuário não deve autorizar. Se
  houver acesso direto Supabase, RLS deve ser defesa adicional, não substituta
  da autorização da aplicação.
- **Teste da correção:** matriz usuário/função/tenant/ferramenta/operação,
  incluindo IDs de outro usuário/tenant, claims antigas, ferramenta desconhecida
  e token sem permissão; negar com `403` e sem revelar existência do objeto.

#### SEC-005 — Ciclo de refresh e isolamento por request indefinidos

- **Severidade:** Alto
- **Confiança:** média
- **Localização:** desenho proposto e runtime Vercel Fluid Compute descrito na
  ADR-0002:24
- **Evidência:** refresh tokens Supabase rotacionam e têm janela limitada de
  reutilização. A orientação oficial alerta que cliente Supabase em escopo de
  módulo no Fluid Compute pode compartilhar sessão entre requests e que cache de
  resposta com `Set-Cookie` pode trocar sessões entre usuários.
- **Cenário de abuso:** instância aquecida reutiliza cliente com sessão
  anterior, ou CDN entrega `Set-Cookie` cacheado a outro usuário; refresh
  concorrente pode revogar a sessão.
- **Pré-condições:** estado por usuário em singleton/global, cache de resposta
  de Auth ou refresh paralelo sem coordenação.
- **Impacto:** vazamento/troca de sessão entre usuários ou indisponibilidade de
  sessão.
- **Recomendação:** criar cliente por request, nunca guardar sessão em
  singleton; coordenar refresh por sessão, aplicar o par novo de tokens
  atomicamente e limpar cookies em falha terminal; marcar todas as respostas de
  Auth e qualquer resposta que faça refresh como
  `Cache-Control: private, no-store`; validar o comportamento real da Vercel.
- **Teste da correção:** requests concorrentes de duas sessões na mesma
  instância não podem cruzar identidade; dois refresh simultâneos devem
  convergir sem revogar a sessão; CDN não pode cachear nem reproduzir
  `Set-Cookie`.

#### SEC-006 — Fronteira de segredos Supabase ainda não modelada

- **Severidade:** Médio
- **Confiança:** alta
- **Localização:** `.gitignore:7-14`, `supabase/.gitignore:1-11`,
  `.env.example`, `packages/config/src/index.ts:5-14`
- **Evidência:** `.env`, PEM e keys já são ignorados e nenhum padrão de segredo
  Supabase foi encontrado em arquivos rastreados. O diff emergente também ignora
  `supabase/.temp`, `supabase/.branches` e `signing_keys.json`. Entretanto,
  ainda não há allowlist/validação das variáveis Supabase no pacote de
  configuração. Os exemplos atuais demonstram credenciais locais fixas, que não
  podem ser confundidas com segredo remoto.
- **Cenário de abuso:** `service_role`, secret key, private JWK, segredo de
  provider ou token da CLI é copiado para `config.toml`, bundle Vite, log, CI ou
  imagem.
- **Pré-condições:** segredo real usado localmente ou em ambiente remoto e
  ausência de classificação/gate automatizado.
- **Impacto:** bypass de RLS, emissão/aceitação de tokens, acesso administrativo
  ou comprometimento do projeto Supabase.
- **Recomendação:** aplicar a classificação da seção 8, usar `env(...)` em
  `config.toml`, preservar os ignores adicionados, validar env por consumidor e
  adicionar secret scanning no CI/pre-commit. Valores `sb_publishable_*`/`anon`
  são públicos por desenho, mas não concedem segurança e ainda devem ser
  separados por ambiente. Nunca expor `service_role`, `sb_secret_*`, private
  JWK/JWT secret ou provider secret com prefixo `VITE_`.
- **Teste da correção:** scan do histórico e árvore; build web não contém
  segredo; logs redigem `Authorization`, `Cookie`, `Set-Cookie`, codes e tokens;
  iniciar com variável ausente/inválida deve falhar sem imprimir valor.

#### SEC-007 — Dynamic Client Registration e consentimento podem ampliar abuso

- **Severidade:** Médio
- **Confiança:** média
- **Localização:** `supabase/config.toml:365-372`
- **Evidência:** o OAuth Server está habilitado, mas a preparação corrigiu o
  risco imediato com `allow_dynamic_registration=false` e definiu clientes
  pré-registrados para o spike. Ainda faltam o contrato definitivo de
  consentimento, scopes e revogação. A documentação oficial informa que scopes
  OIDC padrão não controlam acesso a dados.
- **Cenário de abuso:** atacante registra clientes em massa, usa nome/descrição
  enganosa e induz consentimento amplo; token válido recebe privilégios além do
  necessário.
- **Pré-condições:** DCR público, consentimento pouco informativo ou autorização
  que confia apenas em scopes OIDC.
- **Impacto:** phishing de consentimento, persistência de acesso delegado e
  consumo abusivo de recursos.
- **Recomendação:** começar com clientes pré-registrados, salvo requisito de
  interoperabilidade que justifique DCR; se DCR for necessário, limitar taxa,
  validar metadata e redirects, auditar e permitir revogação. A tela deve exibir
  cliente verificado, operações/dados efetivos, tenant e duração. Definir scopes
  MCP mínimos e vinculá-los à policy da aplicação.
- **Teste da correção:** redirect com wildcard ou mismatch falha; DCR sofre rate
  limit; consentimento negado não emite token; revogação bloqueia novo refresh;
  scope insuficiente retorna `403` com `WWW-Authenticate` apropriado.

#### SEC-011 — Runtime local perdeu separação de privilégio no PostgreSQL

- **Severidade:** Médio
- **Confiança:** alta
- **Localização:** `.env.example:2-3`, `apps/api/.env.example:2`,
  `supabase/config.toml:33-42`
- **Evidência:** o diff emergente aponta `DATABASE_URL` da API e
  `DATABASE_MIGRATION_URL` para a mesma conta `postgres` do banco Supabase
  local. O baseline anterior separava roles de aplicação e migração.
- **Cenário de abuso:** uma injeção, ferramenta MCP defeituosa ou credencial de
  runtime comprometida executa DDL, altera schemas internos ou acessa dados além
  do necessário porque a conexão da aplicação é superusuária.
- **Pré-condições:** API iniciada com o exemplo, caminho de consulta controlável
  ou comprometimento do processo.
- **Impacto:** comprometimento integral e destrutivo do banco local, com
  divergência em relação ao modelo de mínimo privilégio esperado para os demais
  ambientes.
- **Recomendação:** criar role de migração/owner e role de runtime sem
  superuser, `CREATEDB`, `CREATEROLE`, `BYPASSRLS` ou ownership; negar acesso
  direto ao schema `auth` salvo necessidade demonstrada. Preservar URLs
  distintas e documentar como provisioná-las após `supabase start`. Se a decisão
  afetar a fonte de verdade de migrations/ownership, encaminhar ao
  `requirements_architect`.
- **Teste da correção:** a role de runtime consegue executar somente DML
  necessário da aplicação e falha ao criar/drop schema/tabela, mudar roles,
  desabilitar RLS ou ler tabelas internas de Auth; a role de migração permanece
  fora do runtime.

### Sugestões de endurecimento

- **SEC-008 — Informativo, confiança alta:** adotar chaves assimétricas ES256 ou
  RS256, publicar somente JWKS e exercitar rotação de `kid`; não distribuir
  segredo HS256 ao Resource Server.
- **SEC-009 — Informativo, confiança alta:** rate limit por IP, usuário,
  `client_id` e ferramenta; limites de payload, timeout, concorrência e budgets.
- **SEC-010 — Informativo, confiança média:** auditar login, falhas, refresh,
  logout, consentimento, revogação e chamada MCP com correlation ID, `sub`
  pseudonimizado, `client_id`, ferramenta e decisão, nunca tokens/cookies.

## 6. Controles existentes

- `MCP_ENABLED` tem default seguro `false` na validação de configuração.
- ADR-0002 e runbook exigem MCP desabilitado em Preview/Production até existir
  autenticação, autorização por ferramenta e rate limit.
- `.env`, variantes, `*.pem` e `*.key` são ignorados pelo Git; nenhum arquivo de
  segredo correspondente está rastreado e a busca por padrões conhecidos não
  encontrou ocorrência.
- configuração é validada centralmente com Zod e falha no bootstrap.
- CORS possui origin único configurado, embora não substitua CSRF/autenticação.
- Postgres local atual publica a porta apenas em `127.0.0.1`.
- a preparação emergente fixa `supabase@2.111.0`, mantém refresh rotation e
  confirmação de e-mail habilitadas, desabilita login anônimo e adiciona ignores
  para estado temporário e chave privada local.
- credencial de migração é separada da credencial de runtime e o runbook proíbe
  fornecê-la à API.
- CI usa permissões mínimas de `contents: read` e `packages: read`, e checkout
  sem persistir credenciais.

## 7. Riscos aceitos ou residuais conhecidos

- JWT validado offline permanece utilizável até `exp` mesmo após logout, salvo
  introspecção/revogação adicional. O TTL deve refletir esse risco.
- `HttpOnly` reduz roubo por XSS, mas não impede ações autenticadas por scripts
  injetados nem CSRF; CSP e codificação de saída continuam necessárias.
- stack Supabase CLI local usa credenciais padrão, não possui TLS/rate limit e é
  adequada somente a desenvolvimento isolado.
- falha transitória de JWKS/Auth precisa de política fail-closed para novas
  validações, com cache de chave pública limitado; isso pode causar
  indisponibilidade durante incidentes.
- RLS não cobre operações fora de PostgREST nem substitui autorização dos casos
  de uso NestJS.

## 8. Requisitos mínimos de configuração local e segredos

### Configuração versionável

- manter o pin atual `supabase@2.111.0` somente após validar que ele suporta o
  fluxo OAuth MCP local esperado e registrar a política de atualização;
- versionar `supabase/config.toml`, migrations, schemas e seeds sem dados reais;
- definir `project_id`, portas sem conflito, Auth habilitado, `site_url` local e
  redirects exatos apenas para callbacks locais conhecidos;
- manter rotação de refresh habilitada e janela de reuse no default recomendado,
  salvo teste que justifique mudança;
- usar Mailpit/Inbucket local para confirmação, convite e recuperação; nunca
  SMTP real nem destinatários reais;
- manter cadastro, provedores, confirmação de e-mail, recuperação, MFA e OAuth
  Server explicitamente habilitados/desabilitados; não depender de defaults;
- configurar Authorization Path e tela de consentimento se o OAuth Server for
  aprovado;
- separar URL/issuer local, URI canônico do MCP e audience esperada; não aceitar
  aliases como `localhost` e `127.0.0.1` indiscriminadamente;
- manter serviços acessíveis somente pelo host/loopback ou rede Docker interna;
  antes de considerar G1 concluído, substituir
  `db.network_restrictions.enabled=false` e os CIDRs amplos por uma restrição
  coerente ou demonstrar, por teste de portas, que o gateway Docker não é
  alcançável externamente;
- preservar os ignores de `supabase/.temp/`, `supabase/.branches/` e
  `signing_keys.json`, acrescentando dumps locais se forem gerados;
- reconciliar `additional_redirect_urls` com o BFF: callback que troca o code e
  grava cookies deve terminar na API, enquanto `/oauth/consent` é a UI de
  consentimento. Não manter bare origins e aliases `localhost`/`127.0.0.1` sem
  um caso de teste explícito.

### Valores que podem aparecer no cliente

- URL pública local do Supabase;
- `sb_publishable_*` ou `anon` local, quando realmente necessário. Esses valores
  identificam o projeto, não substituem autenticação/autorização e não devem ser
  reutilizados entre ambientes.

### Segredos que nunca podem ser versionados nem enviados ao web

- `sb_secret_*`, `service_role` e JWT `service_role` legado;
- private JWK, `JWT_SECRET`, `JWT_KEYS` com chave privada e qualquer material de
  assinatura;
- segredo de OAuth client confidencial e segredos de providers externos;
- access token da Supabase CLI, senha do banco remoto e connection strings
  privilegiadas;
- refresh/access tokens de usuários, authorization codes, PKCE verifier e
  cookies;
- credenciais SMTP reais, CAPTCHA secret e secrets de webhooks/hooks.

Exemplos devem conter somente placeholders ou credenciais locais claramente
descartáveis. Se um segredo real for encontrado, registrar apenas tipo e
localização, removê-lo do histórico por processo aprovado e revogar/rotacionar.

## 9. Testes de segurança recomendados

1. **Isolamento local:** scan de portas a partir de outro host/container e
   comprovação de que Supabase Studio, DB, Auth e API não estão publicamente
   acessíveis.
2. **Cookies:** atributos, prefixo, domínio/path, expiração, limpeza no logout,
   ausência em `document.cookie` e ausência no bundle/logs.
3. **CSRF e callback:** cross-site POST, origins inválidos/nulos, content types
   simples, `state` ausente/replay, PKCE incorreto e redirects manipulados.
4. **JWT MCP:** assinatura, `alg`, `kid`, `iss`, `aud`, `exp`, `nbf`, tipo de
   token, `client_id`, rotação de JWKS e indisponibilidade do issuer.
5. **Descoberta MCP:** Protected Resource Metadata, `authorization_servers`,
   `WWW-Authenticate`, `resource`, PKCE S256 e cliente MCP real suportado.
6. **Autorização:** matriz por ferramenta/operação/objeto/tenant e claims
   antigas; confirmação de deny by default e ausência de BOLA/IDOR.
7. **Concorrência:** refresh simultâneo, retries, sessão em duas instâncias,
   isolamento entre usuários e nenhuma resposta de Auth cacheada.
8. **Abuso:** password spraying, enumeração de conta, recuperação, DCR,
   consentimento, payload MCP excessivo, chamadas paralelas e budgets.
9. **Revogação:** logout local/global, troca de senha, revogação do OAuth
   client, refresh roubado/reutilizado e efeito de access token ainda válido.
10. **Segredos:** secret scanning em árvore, histórico e artefatos; inspeção do
    bundle Vite, logs, imagens e relatórios de CI.

## 10. Gates antes da implementação

- **G0 — Fontes de verdade:** criar especificação, critérios de aceite e plano;
  aprovar ADR para Supabase Auth/OAuth Server beta, topologia same-origin,
  audience e estratégia de autorização.
- **G1 — Preparação local:** pin da CLI, stack reproduzível, portas isoladas,
  roles de banco separadas, redirects coerentes com o BFF, configuração
  explícita e secret handling validados.
- **G2 — Contratos:** definir endpoints BFF, cookies, CSRF, erros, principal,
  scopes/permissões, URI canônico e claims exigidas.
- **G3 — Web Auth:** login/callback/refresh/logout/recuperação passam pelos
  testes negativos antes de qualquer tela protegida.
- **G4 — Resource Server:** MCP retorna `401`/`403` corretos, implementa
  Protected Resource Metadata e aceita somente token específico para o recurso.
- **G5 — Autorização:** nenhuma ferramenta com dados/efeitos é registrada até a
  matriz por ferramenta/operação/objeto/tenant estar implementada e testada.
- **G6 — Operação:** rate limit, logs redigidos, auditoria, rotação e resposta a
  comprometimento documentados.
- **G7 — Habilitação:** `MCP_ENABLED` continua `false` em Preview/Production até
  todos os gates anteriores e um teste com cliente MCP real passarem.

## 11. Impactos arquiteturais para encaminhamento

Encaminhar ao `requirements_architect`:

- adoção do OAuth 2.1 Server beta do Supabase como Authorization Server;
- estratégia de saída se a capacidade beta mudar ou não interoperar com
  `resource`/Protected Resource Metadata exigidos pelo MCP;
- topologia same-origin definitiva do web/BFF e ownership dos tokens;
- URI canônico/audience por ambiente e Custom Access Token Hook;
- DCR versus clientes pré-registrados;
- modelo de permissões e localização da fonte autoritativa de tenant/roles;
- relação entre migrations Supabase, `packages/database`/Drizzle e RLS, evitando
  duas fontes de verdade para o mesmo esquema;
- política de revogação, sessão, MFA e recuperação.

## 12. Itens não verificados e artefatos

Não foi possível verificar:

- plano técnico e checklist QA; a especificação ainda está **Em esclarecimento**
  e a ADR-0003 está apenas **Proposta**;
- versão/configuração final do Supabase CLI e suporte local efetivo ao OAuth
  Server beta; o binário `2.111.0` foi confirmado, mas o fluxo não foi iniciado;
- métodos de login, MFA, política de cadastro, recuperação e requisitos de
  sessão desejados;
- ferramenta MCP/cliente alvo, scopes, objetos, tenants e workloads futuros;
- configuração Vercel/Supabase remota, DNS, TLS, WAF, rate limits e secret
  store;
- interoperabilidade real do Supabase com `resource` do RFC 8707 e cliente MCP;
- dependências, código e testes futuros.

Artefato criado:

- `docs/security/supabase-auth-bff-mcp.md`.
- `specs/supabase-auth-local/checklists/security.md`.

Não foram encontrados segredos Supabase rastreados nem uma implementação de Auth
para auditar. Isso não significa que o sistema esteja completamente seguro; a
conclusão é limitada ao baseline e ao desenho informado.

## Referências oficiais

- [Supabase: fluxo de desenvolvimento local](https://supabase.com/docs/guides/local-development/cli-workflows)
- [Supabase: OAuth 2.1 Server](https://supabase.com/docs/guides/auth/oauth-server)
- [Supabase: introdução ao OAuth 2.1 Server](https://supabase.com/docs/guides/auth/oauth-server/getting-started)
- [Supabase: autenticação MCP](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication)
- [Supabase: segurança de token e RLS](https://supabase.com/docs/guides/auth/oauth-server/token-security)
- [Supabase: sessões](https://supabase.com/docs/guides/auth/sessions)
- [Supabase: guia avançado de Auth no servidor](https://supabase.com/docs/guides/auth/server-side/advanced-guide)
- [MCP: Authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [RFC 9728: OAuth 2.0 Protected Resource Metadata](https://www.rfc-editor.org/rfc/rfc9728.html)
- [RFC 8707: Resource Indicators for OAuth 2.0](https://www.rfc-editor.org/rfc/rfc8707.html)
