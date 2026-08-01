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

## Ordem de configuração

1. Importe e publique o projeto da API.
2. Configure as variáveis da API em Development, Preview e Production.
3. Valide `GET /api/health`, `/api/docs` e `/mcp`.
4. Importe o projeto web.
5. Defina `VITE_API_URL` com o origin HTTPS estável da API, sem caminho final.
6. Publique o web e valide uma rota profunda da SPA.

## Variáveis da API

O runtime da API valida somente estas variáveis no bootstrap:

- `NODE_ENV=production`;
- `DATABASE_URL`;
- `WEB_URL`;
- `API_URL`;
- `MCP_ENABLED=false`;
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

- `VITE_API_URL`: origin HTTPS da API, por exemplo `https://api.exemplo.com`.

Quando o web e a API forem publicados pelo mesmo origin por meio de rewrite,
remova `VITE_API_URL`; o cliente usará `/api` por padrão.

## Preview deployments

Web e API são projetos independentes. Um preview do web não descobre
automaticamente o preview correspondente da API. Até existir pareamento ou um
proxy estável, configure previews do web contra uma API de homologação e inclua
o origin exato no CORS desse ambiente.

Ative Vercel Authentication ou Standard Protection nos previews e valide o
bloqueio também em uma janela anônima. Mantenha o Vercel Firewall configurado
com limites proporcionais às rotas públicas.

Não aponte previews para o banco de produção. Migrações permanecem fora do build
da Vercel.

## Validação e retorno

Antes de promover uma versão:

1. confirme o build dos dois projetos;
2. teste `GET /api/health`;
3. abra `/api/docs`;
4. valide o handshake e as ferramentas em `/mcp`;
5. recarregue uma rota React que não seja `/`;
6. confirme que nenhum segredo aparece no bundle ou nos logs.

Confirme também que `/mcp` retorna `404` enquanto `MCP_ENABLED=false`, que um
origin fora da allowlist falha no CORS e que Postgres e qualquer futuro S3 estão
na mesma região operacional escolhida para a API. A região única `gru1` não
possui failover definido nesta fase.

O Swagger pode permanecer público enquanto documentar somente rotas sem dados
sensíveis. A política deve ser revista antes da introdução de autenticação ou de
novos contratos protegidos.

Em caso de falha, use Instant Rollback para retornar ao deployment anterior. As
migrações de banco exigem uma estratégia de retorno própria e não devem ser
revertidas automaticamente junto com o código.
