# Deploy na Vercel

## Topologia

Crie dois projetos Vercel a partir do mesmo repositório:

| Projeto | Root Directory | Framework | Região     |
| ------- | -------------- | --------- | ---------- |
| Web     | `apps/web`     | Vite      | CDN global |
| API     | `apps/api`     | NestJS    | `gru1`     |

Use Node.js 22 nos dois projetos. A Vercel reconhece o `pnpm-lock.yaml` da raiz
e os pacotes `workspace:*`. Mantenha habilitada a inclusão de arquivos externos
ao Root Directory para que os pacotes compartilhados sejam construídos.

Para a autenticação web, o navegador deve acessar somente o origin público do
projeto web. O projeto web encaminha `/api/:path*` para o projeto da API e
mantém a URL visível como `/api/:path*`. O rewrite não inclui `/mcp`: esse
endpoint continua pertencendo exclusivamente ao origin da API e permanece
desabilitado em Preview e Production.

O destino do rewrite é fornecido no servidor pela variável `API_PROXY_ORIGIN`.
Seu valor deve ser o origin HTTPS estável e real do projeto da API, sem path ou
barra final. Não use URL fictícia nem URL de um deployment efêmero.

A API usa a detecção zero-config do NestJS e não deve possuir Build Command ou
Output Directory customizados. A Vercel detecta o Turborepo pelo monorepo e
constrói primeiro os pacotes compartilhados. O projeto web mantém no
`vercel.json` seu build filtrado a partir da raiz.

## Ordem de configuração

1. Importe e publique o projeto da API.
2. Configure as variáveis da API em Development, Preview e Production.
3. Valide `GET /api/health` diretamente no origin da API e confirme que `/mcp`
   retorna `404` fora de Development.
4. Importe o projeto web.
5. Enquanto a autenticação ainda não estiver ativa, use `VITE_API_URL` somente
   para o fluxo legado cross-origin que explicitamente o suporta.
6. Antes de ativar autenticação em um ambiente, defina o alias estável da API,
   configure `API_PROXY_ORIGIN` no projeto web, remova `VITE_API_URL` desse
   ambiente e configure `WEB_URL` na API com o origin público exato do web.
7. Publique primeiro a API e depois o web; valide o proxy, os cookies e uma rota
   profunda da SPA antes da promoção.

Nos ambientes Preview e Production do projeto web, configure `NODE_AUTH_TOKEN`
como Sensitive para baixar os pacotes `@arcsyn-io/*` do GitHub Packages. Use um
PAT classic com somente o escopo `read:packages`, preferencialmente de uma conta
técnica, com expiração e rotação definidas. Não disponibilize esse token ao
projeto da API.

## Variáveis da API

O runtime da API valida somente estas variáveis no bootstrap:

- `NODE_ENV=production`;
- `DATABASE_URL`;
- `WEB_URL`;
- `API_URL`;
- `MCP_ENABLED=false`;
- `AUTH_JWT_SECRET` e `AUTH_RATE_LIMIT_SECRET`, gerados separadamente com pelo
  menos 256 bits aleatórios e codificados em base64url;
- `AUTH_JWT_ISSUER` e `AUTH_JWT_AUDIENCE`, distintos por ambiente;
- limites e janelas `AUTH_LOGIN_*`;
- `LOG_LEVEL`.

`PORT` é fornecida pela Vercel. `API_PORT` permanece como fallback local e não
precisa ser definida na plataforma. Não use valores fictícios para variáveis
obrigatórias e não exponha segredos com o prefixo `VITE_`.

`DATABASE_URL` deve usar o pooler recomendado pelo provedor para Functions. A
credencial deve pertencer a uma role de aplicação com mínimo privilégio.

`DATABASE_MIGRATION_URL` pertence exclusivamente à etapa protegida de migração:
não a configure no projeto Vercel da API. Também não configure credenciais S3
enquanto não existir um módulo que as consuma. Preview e Production devem usar
roles, bancos e buckets distintos. Marque todos os valores sensíveis como
Sensitive no dashboard e mantenha um procedimento de rotação.

O MCP permanece desabilitado em Preview e Production. Antes de habilitá-lo,
implemente autenticação, autorização por ferramenta e rate limit; configure
budgets e alertas de uso para evitar abuso e custo inesperado.

## Variáveis do web

- `API_PROXY_ORIGIN`: origin HTTPS estável da API, sem path ou barra final;
- `VITE_API_URL`: origin HTTPS da API somente durante a transição cross-origin
  anterior à autenticação.

O `vercel.json` do web mantém o rewrite de `/api/:path*` antes do fallback da
SPA e autoriza somente essa variável no destino em runtime:

```json
{
  "source": "/api/:path*",
  "destination": "$API_PROXY_ORIGIN/api/:path*",
  "env": ["API_PROXY_ORIGIN"],
  "respectOriginCacheControl": false
}
```

`respectOriginCacheControl: false` desabilita cache para esse rewrite. As
respostas de autenticação e sessão também enviam
`Cache-Control: private, no-store`; valide no deployment que a CDN não as
armazena.

Não adicione rewrite para `/mcp`. No desenvolvimento local, o Vite deve
encaminhar apenas `/api` para `http://localhost:3000`; clientes MCP usam o
origin da API diretamente quando o endpoint está explicitamente habilitado em
Development.

Quando o rewrite estiver ativo, remova `VITE_API_URL`; o cliente usa `/api` por
padrão. A autenticação por cookie não suporta fallback cross-origin. Se
`API_PROXY_ORIGIN` ainda não apontar para um alias estável ou se o rewrite ainda
não estiver publicado e validado, não promova uma versão que exponha a
autenticação em Preview ou Production.

## Preview deployments

Web e API são projetos independentes. Um preview do web não descobre
automaticamente o preview correspondente da API. `API_PROXY_ORIGIN` de Preview
deve apontar para uma API estável de homologação, nunca para um deployment
efêmero ou para Production.

A validação de `Origin` da autenticação exige que `WEB_URL` na API corresponda
ao origin público exato do web. Portanto, previews efêmeros arbitrários não
podem habilitar autenticação enquanto não existir um origin web fixo, protegido
e aprovado para homologação. Essa definição é uma pré-condição operacional; o
repositório não inventa alias ou domínio para supri-la. Até sua resolução,
mantenha a autenticação fora dos previews e valide somente os fluxos públicos
compatíveis com a topologia anterior.

Ative Vercel Authentication ou Standard Protection nos previews e valide o
bloqueio também em uma janela anônima. Mantenha o Vercel Firewall configurado
com limites proporcionais às rotas públicas.

Não aponte previews para o banco de produção. Migrações permanecem fora do build
da Vercel.

## Validação e retorno

Antes de promover uma versão:

1. confirme o build dos dois projetos;
2. execute `GET /api/health` pelo origin do web e confirme que a resposta veio
   da API;
3. confirme que Swagger não é servido em Preview ou Production;
4. confirme no origin direto da API que `/mcp` retorna `404` e que uma chamada a
   `/mcp` no web não foi encaminhada à API;
5. recarregue uma rota React que não seja `/`;
6. valide login, renovação e logout pelo origin do web, incluindo todos os
   headers `Set-Cookie` separados e os atributos esperados;
7. confirme que nenhum segredo, cookie ou token aparece no bundle ou nos logs.

Use um origin real do ambiente e uma conta de teste autorizada. Não coloque
senha, cookie ou token na linha de comando, no histórico ou em evidências. As
verificações públicas podem ser executadas sem credenciais:

```bash
curl --fail-with-body --silent --show-error \
  "${WEB_ORIGIN}/api/health"
curl --silent --show-error --output /dev/null --write-out '%{http_code}\n' \
  "${API_ORIGIN}/mcp"
```

O primeiro comando deve retornar o payload saudável da API. O segundo deve
imprimir `404` em Preview e Production. Para login, renovação e logout, use o
painel Network do navegador no origin web: confirme três headers `Set-Cookie`
independentes, cookies `__Host-*`, `Secure`, `Path=/`, ausência de `Domain` e as
respostas esperadas para `Origin` e CSRF inválidos. Registre somente o resultado
e os atributos, nunca os valores dos cookies.

Confirme também que `/mcp` retorna `404` enquanto `MCP_ENABLED=false`, que um
origin fora da allowlist falha na validação de `Origin` e que Postgres e
qualquer futuro S3 estão na mesma região operacional escolhida para a API. A
região única `gru1` não possui failover definido nesta fase.

Observe no projeto web os status, volume, erros e latência do external rewrite
e, na API, aumentos de `401`, `429`, replay e indisponibilidade do PostgreSQL.
Preserve o identificador de correlação entre os dois projetos e não registre
headers `Cookie`, `Set-Cookie` ou tokens. Limites de alerta e retenção dependem
de objetivos operacionais aprovados; este runbook não inventa SLOs.

Em caso de falha no proxy ou nos cookies, use Instant Rollback no projeto web
para retornar ao deployment anterior à ativação da autenticação. Se houver
incompatibilidade de contrato, reverta também a API para a versão compatível.
Faça primeiro o rollback do código e só depois restaure a configuração anterior
do projeto web. Mantenha `MCP_ENABLED=false` durante todo o retorno.

Migrações de banco exigem uma estratégia de retorno própria e não devem ser
revertidas automaticamente junto com o código. Como a autenticação introduz
dados persistentes, prefira migrações compatíveis com a versão anterior durante
a janela de rollback.

Os procedimentos de rotação de segredo, revogação global, desativação de conta e
limpeza estão em [Operação da autenticação](autenticacao.md).
