# ADR-0003: Sessão web JWT em cookie HttpOnly

- **Status:** Aceita
- **Data:** 2026-08-03
- **Responsáveis:** equipe de desenvolvimento do ArcSyn Shift
- **Funcionalidade relacionada:**
  [autenticação web com JWT em cookie HttpOnly](../../../specs/auth-jwt-cookie/spec.md)

## Contexto

O ArcSyn Shift ainda não possui usuários, autenticação ou autorização. A web e a
API são projetos Vercel independentes e, enquanto usam origins distintos,
dependem de `VITE_API_URL` e CORS. A ADR-0002 já registrou que `/api` deve ser
encaminhado pelo origin do web antes da adoção de autenticação por cookie.

A aplicação precisa autenticar contas locais provisionadas internamente, sem
expor tokens de sessão ao JavaScript. Também precisa limitar o impacto de roubo
ou replay, permitir logout e desativação de conta, proteger mutações contra CSRF
e funcionar no runtime serverless da API.

## Forças de decisão

- impedir acesso do JavaScript às credenciais de sessão;
- manter web e API como aplicações independentes, com uma fronteira pública
  same-origin;
- reduzir a janela de exposição de um access token roubado;
- permitir renovação, revogação e detecção de replay;
- negar autenticação de forma segura sob falha de persistência;
- proteger operações mutáveis contra CSRF;
- evitar estado de autenticação somente em memória no runtime serverless;
- estender a stack e as fronteiras existentes;
- não criar implicitamente um contrato de autenticação para MCP;
- preservar rastreabilidade operacional sem registrar segredos.

## Alternativas consideradas

### JWT longo e único em cookie HttpOnly

Reduz persistência e número de fluxos, mas logout não invalida uma cópia do
token e desativação de conta só produz efeito ao final de uma janela longa. O
risco de replay é incompatível com uma sessão de 30 dias.

### Access JWT curto sem renovação

Mantém validação simples e limita replay a uma janela curta, mas força novo
login a cada expiração. Não atende à duração de sessão aprovada.

### Access JWT e refresh JWT sem persistência

Permite renovação, mas não oferece uso único, detecção confiável de replay nem
revogação por família. Um refresh roubado permanece útil até expirar.

### Access JWT curto e refresh opaco rotativo persistido

Mantém o access token autocontido por uma janela curta e usa PostgreSQL para
rotação, revogação e detecção de replay do refresh. Exige tabelas, transações,
limpeza e operação adicional, mas satisfaz as propriedades de segurança e ciclo
de sessão necessárias.

### Sessão opaca integralmente server-side

Simplifica revogação e reduz claims expostas, mas substitui a decisão de usar
JWT para autenticação web e exige consulta de sessão em toda requisição.

### Web e API cross-origin com cookies de credenciais

É tecnicamente possível com CORS credentials e políticas específicas de cookie,
mas amplia a matriz de origin, Preview e CSRF. Contraria a pré-condição
same-origin já estabelecida pela ADR-0002.

### Proteção CSRF somente com SameSite

`SameSite=Lax` reduz ataques cross-site comuns, mas não expressa intenção da
requisição nem substitui validação de origin. A combinação de `Origin` e token
CSRF fornece defesa em profundidade para mutações.

## Decisão

Adotar para a web first-party:

1. Identidade local por email e senha, exclusivamente para contas provisionadas
   internamente. Não haverá cadastro nem recuperação públicos nesta decisão.
2. Access JWT com duração de 10 minutos. Em produção, ele usará o cookie
   `__Host-arcsyn_access`, `HttpOnly`, `Secure`, `Path=/`, sem `Domain` e
   `SameSite=Lax`. No desenvolvimento local por HTTP, usará `arcsyn_access`, sem
   `Secure`, mantendo `HttpOnly`, `Path=/`, ausência de `Domain` e
   `SameSite=Lax`.
3. Aceitação do access JWT exclusivamente pelo cookie. A API não aceitará JWT
   por `Authorization`, query string ou corpo.
4. Refresh token opaco, imprevisível, rotativo e HttpOnly, com validade máxima
   de 30 dias. Em produção, os cookies de refresh e CSRF também usarão nomes
   `__Host-*`, `Secure`, `Path=/`, sem `Domain` e `SameSite=Lax`; no
   desenvolvimento local por HTTP, usarão nomes equivalentes sem `__Host-` e sem
   `Secure`. Somente o hash do refresh e os metadados de família serão
   persistidos no PostgreSQL.
5. Consumo atômico e de uso único do refresh. Reutilização de token consumido
   revoga toda a família para interromper replay.
6. `DELETE /api/auth/session` realizará o logout, revogará a família
   identificável e removerá todos os cookies associados. Desativação de conta
   revogará todas as suas famílias.
7. A revogação do access JWT já emitido não será consultada por requisição; sua
   exposição residual máxima será de 10 minutos.
8. Requisições mutáveis autenticadas exigirão `Origin` exato permitido e token
   CSRF associado à sessão. O login também exigirá `Origin` exato permitido para
   mitigar login CSRF, mas não exigirá token CSRF, pois ainda não haverá sessão.
   O logout idempotente exigirá `Origin` exato, mas poderá revogar uma família
   identificável mesmo sem CSRF, evitando que a ausência desse token preserve um
   refresh reutilizável. O token CSRF não será credencial de autenticação.
9. A API aplicará guard global. Health e endpoints de autenticação estritamente
   necessários serão públicos por marcação explícita. Não haverá roles nesta
   etapa.
10. Swagger será montado somente em desenvolvimento. MCP permanecerá
    desabilitado e não compartilhará automaticamente a autenticação do
    navegador.
11. Login e renovação usarão rate limit persistido, não limitado à memória de
    uma Function.
12. Em produção, o web acessará a API por `/api` no mesmo origin. O proxy deverá
    preservar separadamente todos os headers `Set-Cookie`.
13. Contratos ficarão em `packages/contracts`, configuração e validação em
    `packages/config`, e usuários/sessões/rate limit persistente sob a
    propriedade de dados definida em `packages/database` e no módulo de
    autenticação.
14. Logs usarão Pino por meio de `packages/observability` e não conterão senha,
    JWT, refresh token, token CSRF completo ou hashes sensíveis.

O plano técnico deverá fixar algoritmo e rotação de chave JWT, algoritmo e
parâmetros de hash de senha, nomes dos cookies auxiliares, header CSRF e modelo
de rate limit após revisão de segurança, sem enfraquecer estas garantias.

## Consequências positivas

- JWT e refresh token não ficam acessíveis ao JavaScript.
- O access token possui janela de exposição curta.
- Refresh tokens podem ser revogados e replay pode ser detectado.
- Logout e desativação têm efeito imediato sobre futuras renovações.
- Same-origin reduz a complexidade de CORS e cookies.
- CSRF possui defesa em profundidade.
- O estado crítico sobrevive a cold starts e múltiplas instâncias.
- Contratos e dados permanecem nas fronteiras já adotadas pelo monorepo.

## Consequências negativas

- A autenticação deixa de ser totalmente stateless.
- Login e refresh dependem da disponibilidade do PostgreSQL e do armazenamento
  de rate limit.
- Rotação atômica, replay e concorrência entre abas aumentam a complexidade.
- São necessárias migrações, limpeza de sessões e procedimentos de rotação.
- Um access JWT emitido pode permanecer válido por até 10 minutos após logout ou
  desativação.
- Os nomes dos cookies diferem entre produção e desenvolvimento HTTP, exigindo
  configuração e testes explícitos para emissão e remoção em cada ambiente.

## Riscos

- condição de corrida produzir duas cadeias válidas a partir do mesmo refresh;
- falso replay por renovações concorrentes em múltiplas abas;
- hash fraco ou comparação insegura de senha/refresh token;
- chave JWT com baixa entropia, vazamento ou rotação sem sobreposição adequada;
- configuração incorreta de cookie criar shadowing ou impedir sua remoção;
- proxy combinar ou remover headers `Set-Cookie`;
- token CSRF não vinculado à sessão ou origin permissivo;
- rate limit permitir enumeração, bloqueio abusivo ou bypass distribuído;
- crescimento sem limpeza das tabelas de sessão e rate limit;
- dados sensíveis vazarem por logs ou telemetria;
- reativação acidental de Swagger ou MCP em produção.

## Impactos

### Frontend

Será criada uma feature de autenticação com formulário, bootstrap da sessão,
renovação coordenada, logout e proteção de rotas. O web não lerá cookies de
access/refresh. Mutations incluirão o token CSRF, e redirecionamentos pós-login
aceitarão somente destinos internos válidos.

### Backend

Será criado um módulo `auth` segundo a ADR-0001. A API terá guard global,
marcação de rotas públicas, endpoints de autenticação, emissão/validação JWT,
cookies, CSRF, rate limit e persistência de usuários e famílias de refresh.

### Dados

O PostgreSQL receberá estruturas para contas locais, credenciais e famílias de
refresh, com hashes, estado, expiração, consumo e revogação. O mecanismo de rate
limit também será persistido. Toda alteração terá migração revisável e limpeza
idempotente.

### Infraestrutura

O projeto web encaminhará `/api` à API estável no mesmo origin. Chaves e peppers
serão configurados como segredos por ambiente. Preview e Production usarão dados
e segredos separados. A solução de rate limit persistente deverá ser compatível
com múltiplas Functions.

### Segurança

Mudam os limites de confiança, o armazenamento de credenciais e a superfície
pública. Será obrigatória revisão de hashing, cookies, CSRF, claims, rotação,
replay, rate limit, enumeração, logs, Swagger e MCP.

### Testes

Serão necessários testes unitários, integração HTTP com cookies reais,
concorrência transacional, replay, CSRF, rate limit distribuído, ambientes,
proxy, regressão de health e ausência de segredos. Testes de navegador são
desejáveis, embora a ferramenta E2E ainda não esteja decidida.

### Operação

Operação deverá monitorar falhas de login, `401`, `429`, replay, revogações e
erros do PostgreSQL. Serão necessários runbooks para rotação de chaves,
revogação global, incidente de credencial e limpeza/retenção de sessões.

## Plano de adoção ou migração

1. Fixar no plano técnico os algoritmos, nomes auxiliares, política de rate
   limit e retenção, submetendo-os à revisão de segurança.
2. Definir contratos públicos em `packages/contracts` com propriedade exclusiva
   do backend nesta etapa.
3. Adicionar e validar configurações e segredos por ambiente.
4. Criar esquema e migrações para usuários, credenciais, refresh e rate limit.
5. Implementar o módulo `auth`, transações, guard global, cookies, CSRF e logs.
6. Restringir Swagger ao desenvolvimento e preservar MCP desabilitado.
7. Configurar e validar o proxy same-origin `/api` antes de ativar cookies em
   Preview ou Production.
8. Implementar o web somente após estabilização dos contratos compartilhados.
9. Executar revisão de segurança e cenários rastreáveis de QA.
10. Implantar de forma controlada, validar `Set-Cookie`, CSRF, rotação, replay e
    rollback antes da promoção.

Não há migração de usuários existentes, pois o repositório não possui contas. O
provisionamento inicial seguirá um processo interno separado e auditável.

## Evidências de validação

- todos os critérios AC-001 a AC-018 da especificação aprovados;
- SQL de migração revisado e aplicado em ambiente isolado;
- testes demonstrando consumo atômico e detecção de replay;
- evidência de que JWT por `Bearer` é rejeitado;
- inspeção de cookies em HTTPS confirmando prefixo e atributos;
- teste cross-origin confirmando que todas as mutações rejeitam `Origin` não
  permitido e que, exceto no logout idempotente, rejeitam falhas de CSRF;
- teste multi-instância ou equivalente confirmando rate limit persistente;
- `/api/health` público, Swagger ausente e MCP desabilitado fora de
  desenvolvimento;
- bundle, respostas, logs e telemetria sem credenciais ou tokens;
- proxy same-origin preservando todos os headers `Set-Cookie`;
- lint, typecheck, testes e build dos pacotes e aplicações afetados aprovados.
