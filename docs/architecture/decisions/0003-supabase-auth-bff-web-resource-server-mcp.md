# ADR-0003: Supabase Auth com BFF web e Resource Server MCP

- **Status:** Proposta
- **Data:** 2026-08-04
- **Responsáveis:** equipe de desenvolvimento do ArcSyn Shift
- **Funcionalidade relacionada:**
  [fundação local do Supabase Auth](../../../specs/supabase-auth-local/spec.md)

## Contexto

O `master` ainda não possui autenticação. A PR #11, disponível na branch
`codex/autenticacao-jwt-http-only`, propõe identidade local, hashing de senha,
JWT, refresh rotativo, persistência de sessões e cookies implementados pelo
ArcSyn Shift. A nova direção é substituir essa solução por Supabase Auth
completo, sem integrar o código de JWT próprio.

A API NestJS terá duas responsabilidades deliberadamente distintas:

- BFF da web, mantendo tokens Supabase em cookies HttpOnly e não no JavaScript;
- OAuth 2.1 Resource Server do MCP, aceitando Bearer token de usuário.

Não haverá identidade de workload neste momento. O Supabase Auth será o
Authorization Server e a fonte de identidade humana. A stack local atual já
possui PostgreSQL em Docker Compose e Drizzle como proprietário do schema de
aplicação, portanto a adoção da stack Supabase cria uma decisão de propriedade e
migração de dados.

Há uma restrição relevante: em 2026-08-04, o OAuth 2.1 Server do Supabase está
em beta. Sua documentação descreve Authorization Code com PKCE, discovery, JWKS,
clientes e consentimento, mas não declara o suporte a Resource Indicators
(`resource`, RFC 8707) exigido pelo MCP vigente. A decisão para MCP é, portanto,
condicionada a uma prova de compatibilidade.

## Forças de decisão

- uma única identidade humana para web e MCP;
- retirar da aplicação a responsabilidade por senha, JWT e refresh;
- tokens da web inacessíveis ao JavaScript;
- compatibilidade OAuth/MCP e validação local por JWKS;
- impedir confusão entre cookies da web e Bearer do MCP;
- desenvolvimento local reproduzível e independente de projeto remoto;
- evitar dois bancos locais e duas fontes de verdade;
- preservar Drizzle e os pacotes compartilhados existentes;
- manter aplicação desacoplada do schema interno do provedor;
- limitar novas dependências, serviços e custo operacional;
- deixar explícito o risco de tecnologia beta e a estratégia de saída;
- excluir identidade de workload sem criar um atalho por service role.

## Alternativas consideradas

### JWT e refresh próprios da PR #11

Oferecem controle completo e evitam dependência externa, mas tornam a equipe
responsável por hashing, rotação, replay, provisionamento, recuperação, MFA e
operação do ciclo de identidade. Não atendem à nova decisão de Supabase Auth.

### Supabase Auth somente para web e outro Authorization Server para MCP

Reduz o risco de incompatibilidade MCP, mas duplica identidade, consentimento,
tokens e operação. Só deve ser reconsiderada se o gate RFC 8707 falhar e MCP não
puder ser adiado.

### Web acessando Supabase Auth diretamente

É o fluxo mais comum do SDK, porém entrega tokens ao runtime do navegador e
enfraquece a decisão explícita de BFF com cookies HttpOnly. Também aumenta o
acoplamento da interface ao provedor.

### BFF com sessão opaca própria e tokens Supabase apenas server-side

Maximiza controle e permite revogação local, mas reintroduz persistência e ciclo
de sessão próprios. Pode ser necessário no futuro, porém não é o mínimo para a
fundação.

### Supabase Auth local apontado ao PostgreSQL atual do Compose

Preserva a porta e o container existentes, mas exige operar manualmente Auth,
migrações internas, gateway e chaves. Diverge do fluxo suportado pela Supabase
CLI e aumenta risco de incompatibilidade de versões.

### Stack Supabase local ao lado do PostgreSQL atual

É simples para experimentar, mas cria dois bancos e ambiguidade sobre onde ficam
dados de aplicação, `auth.users` e migrações. Não é adequada como baseline.

### Supabase Cloud compartilhado para desenvolvimento

Reduz containers locais, porém cria dependência de rede, credenciais pessoais,
estado compartilhado e risco de testes destrutivos. Continua útil para
integração, não como ambiente local mínimo.

### Supabase CLI como dona de todas as migrações

Unifica reset e deploy, mas substitui a decisão e ferramentas atuais do
`packages/database`. A fundação pode manter Drizzle e um comando composto,
adiando uma migração de ownership sem benefício imediato.

## Decisão proposta

Adotar, condicionado à aprovação desta ADR e ao gate MCP:

1. Supabase Auth será a única fonte de contas, identidades, credenciais, sessões
   e refresh tokens de pessoas, e o único emissor de tokens de usuário.
2. A API NestJS será BFF da web. Access e refresh Supabase serão transportados
   apenas em cookies HttpOnly; o web não manterá tokens em memória persistente,
   Web Storage, URL ou corpo de resposta.
3. A API será OAuth 2.1 Resource Server do MCP. `/mcp` aceitará exclusivamente
   Bearer token em cada requisição e publicará Protected Resource Metadata.
4. Web e MCP usarão validadores distintos. Cookie web não autenticará MCP e
   Bearer MCP não autenticará contratos BFF.
5. A identidade do principal será o `sub` do Supabase. Email e metadados
   mutáveis não serão chave de negócio.
6. Não haverá identidade de workload, `client_credentials`, uso de service role
   como principal nem impersonação sem usuário.
7. A stack local será executada por Supabase CLI fixada no repositório. O
   PostgreSQL da stack Supabase substituirá o PostgreSQL atual do Compose no
   caminho principal; MinIO continuará separado.
8. Drizzle continuará proprietário do schema de aplicação e não mapeará nem
   migrará tabelas internas do schema `auth`. Start/reset local executará uma
   sequência composta que inclui migrações e seed da aplicação.
9. Integrações usarão configuração validada para URL, issuer, JWKS, audience,
   URI canônico MCP e chave publicável. Secret/service role não será requisito
   do runtime comum nem chegará ao navegador.
10. Tokens destinados ao MCP usarão assinatura assimétrica verificável por JWKS.
    A API validará algoritmo, assinatura, issuer, audience/recurso, expiração,
    subject e `client_id` quando aplicável.
11. MCP permanecerá desabilitado fora de prova controlada até demonstrar que a
    versão fixada do Supabase trata `resource` e produz token que pode ser
    vinculado ao URI canônico conforme o MCP vigente.
12. Se o gate falhar, a equipe deverá escolher explicitamente entre Custom
    Access Token Hook comprovadamente compatível, outro Authorization Server ou
    adiamento do MCP. A API não aceitará `aud=authenticated` como substituto
    silencioso de resource binding.
13. Consentimento, cadastro de clientes, autorização por ferramenta e métodos de
    login serão especificados antes da implementação de produto. Scopes OIDC
    atuais do Supabase não serão tratados como permissões de negócio.
14. Cookies web manterão proteção CSRF por Origin e token/garantia equivalente,
    atributos seguros por ambiente e respostas de sessão não cacheáveis.
15. Tipos Supabase ficarão nos adaptadores. Casos de uso e contratos públicos
    dependerão de tipos próprios dos pacotes existentes.

## Consequências positivas

- web e MCP compartilham a mesma identidade humana;
- senha, refresh e assinatura de tokens deixam de ser responsabilidades
  próprias;
- a aplicação pode evoluir para recuperação, MFA e provedores suportados sem
  reconstruir o núcleo de identidade;
- cookies HttpOnly reduzem exposição a JavaScript na web;
- JWKS assimétrico evita compartilhar segredo de assinatura com o Resource
  Server;
- separação de guards reduz token substitution e credential confusion;
- stack local permite testes destrutivos e reprodutíveis;
- Drizzle e limites modulares existentes são preservados.

## Consequências negativas

- Supabase torna-se dependência estrutural de runtime e operação;
- o OAuth Server necessário ao MCP está em beta;
- a stack local consome mais containers, portas, disco e tempo de inicialização;
- scripts de start/reset precisam coordenar CLI Supabase e Drizzle;
- a API BFF ainda precisa implementar cookies, CSRF, refresh e cache seguro;
- a aplicação precisa construir tela de consentimento OAuth;
- scopes atuais do Supabase não modelam autorização de ferramentas;
- MinIO e Supabase coexistem, ainda que apenas capacidades Auth/DB sejam usadas;
- revogação de refresh não invalida automaticamente todo access token já
  emitido.

## Riscos

- mudança incompatível ou descontinuação da funcionalidade beta;
- Supabase não aceitar Resource Indicators ou não emitir audience por recurso;
- aceitar token de usuário comum no MCP sem vínculo ao recurso;
- registro dinâmico permitir cliente ou redirect malicioso;
- service role vazar ou contornar autorização;
- SDK com estado compartilhado misturar sessões entre requests serverless;
- cookie ou resposta de refresh ser armazenado por CDN;
- rotação de signing key e cache JWKS causarem rejeição ou aceitação indevida;
- schemas/migrações Supabase e Drizzle divergirem após reset;
- duas instâncias PostgreSQL serem usadas acidentalmente;
- deleção de `auth.users` deixar dados órfãos ou apagá-los sem política
  aprovada;
- consentimento exibir scopes OIDC como se limitassem acesso de negócio;
- stack local sem hardening ser exposta à rede.

## Impactos

### Frontend

Receberá login, bootstrap, logout e consentimento em etapas posteriores. Não
usará tokens nem secret/service role. Consumirá somente contratos BFF e deverá
preservar `authorization_id` com validação contra redirecionamento aberto. As
jornadas serão desenhadas e implementadas mobile first, com aprimoramento
progressivo para tablet e desktop e sem perda de acessibilidade ou paridade
funcional entre tamanhos de tela.

### Backend

Receberá módulo/adaptador Supabase, contratos de sessão, cookies, CSRF, guards
separados, validação JWKS, Protected Resource Metadata e consentimento. A
composição MCP atual precisa migrar de controller sem proteção para Resource
Server conforme a especificação do protocolo.

### Dados

Supabase será proprietário do schema `auth`; Drizzle continuará proprietário do
schema de aplicação. O UUID `sub` será a referência de identidade. Política de
FK, remoção e retenção ainda deve ser aprovada.

### Infraestrutura

Supabase CLI e seus containers entram no ambiente local. O PostgreSQL legado do
Compose sai do caminho principal e MinIO permanece. Produção Cloud versus
self-hosted, backup e região não são decididos por esta ADR.

### Segurança

São criados novos limites de confiança, cookies, consentimento OAuth, chaves,
JWKS, redirects e Bearer público. Revisão de segurança é obrigatória antes de
habilitar autenticação ou MCP fora do local.

### Testes

Serão necessários testes de lifecycle local, migração/reset, falha do Auth,
cookies/CSRF/cache, JWKS/rotação, claims, discovery, PKCE, consentimento,
resource/audience, separação BFF/MCP e vazamento de segredo.

### Operação

Operação precisará gerenciar projetos por ambiente, chaves, clientes, grants,
usuários, rate limits, logs/auditoria, atualização da CLI e incidentes do
provedor. A dependência beta exige monitoramento de release notes e rollback.

## Plano de adoção ou migração

1. Aprovar as questões sobre beta, métodos de identidade e ownership de dados.
2. Fixar Supabase CLI >= 2.54.11 e versionar configuração local sem segredos.
3. Fazer o PostgreSQL Supabase assumir o caminho local e preservar MinIO.
4. Adaptar o fluxo Drizzle/start/reset e comprovar um clone limpo.
5. Criar usuário técnico e validar Auth, discovery e JWKS assimétrico.
6. Executar o gate MCP com Authorization Code + PKCE, `resource`, audience e
   claims sanitizadas.
7. Se o gate passar, estabilizar contratos em `packages/contracts` e
   configuração em `packages/config`, ambos com proprietário único.
8. Implementar BFF web e revisar cookies, CSRF e cache antes do frontend.
9. Implementar consentimento, Protected Resource Metadata e guard MCP.
10. Fazer revisões de segurança e QA rastreadas pela especificação.
11. Definir projeto e postura de produção em decisão complementar antes do
    deploy externo.

Não existe migração de usuários. O código e as migrações próprios da PR #11 não
devem ser mesclados ou usados como baseline; partes independentes de UI ou
contrato só podem ser reaproveitadas após revisão contra a nova especificação.

## Evidências de validação

- Em 2026-08-05, o ambiente local concluiu login, refresh e Authorization Code
  com PKCE S256 usando Supabase Auth 2.194.0 e chave ES256 publicada por JWKS.
- No mesmo spike, o parâmetro RFC 8707 `resource=http://localhost:3000/mcp` foi
  aceito na requisição, mas não apareceu nos detalhes da autorização; o access
  token manteve `aud=authenticated`. Consequentemente, o gate do MCP não foi
  aprovado e `MCP_ENABLED` permanece `false`.

- AC-001 a AC-010 da especificação aprovados para a fundação local;
- log sanitizado de versão/status da CLI e serviços saudáveis;
- reset comprovando Supabase `auth` e migrações Drizzle no mesmo banco;
- discovery OAuth/OIDC e JWKS assimétrico acessíveis localmente;
- prova PKCE demonstrando tratamento de `resource` e audience;
- `/mcp` mantido desabilitado quando o gate não for satisfeito;
- posteriormente, AC-011 a AC-020, revisão de segurança, QA e verificações do
  monorepo aprovadas.

## Referências

- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)
- [OAuth 2.1 Server do Supabase](https://supabase.com/docs/guides/auth/oauth-server/getting-started)
- [OAuth flows e scopes](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows)
- [Autenticação MCP com Supabase](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication)
- [JWT e JWKS do Supabase](https://supabase.com/docs/guides/auth/jwts)
- [Autorização MCP](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
