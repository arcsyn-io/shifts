# ArcSyn Shift

Configuração inicial do monorepo, sem regras de negócio, entidades ou casos de
uso do produto.

## Requisitos

- Node.js 20+
- pnpm 9+
- Docker Desktop com Docker Compose

## Instalação

```bash
pnpm install
cp .env.example .env
```

No PowerShell, use `Copy-Item .env.example .env`.

## Infraestrutura e execução

```bash
pnpm infra:up
pnpm db:migrate
pnpm auth:seed
pnpm dev
```

Serviços locais:

- Web: http://localhost:5173
- API health: http://localhost:3000/api/health
- Swagger: http://localhost:3000/api/docs
- Supabase API/Auth: http://127.0.0.1:54321
- Supabase Studio: http://127.0.0.1:54323
- emails locais: http://127.0.0.1:54324
- MinIO Console: http://localhost:9001 (`minio` / `miniosecret`)

O Supabase CLI administra o PostgreSQL e o schema reservado `auth`. O Drizzle
continua administrando somente as tabelas da aplicação no mesmo banco. O MinIO
cria automaticamente o bucket `arcsyn-shift-local`.

## MCP

O adaptador MCP vive dentro de `apps/api` e compartilha o `HealthService` com o
adaptador HTTP. A configuração mínima é:

```json
{
  "mcpServers": {
    "arcsyn-shift": { "url": "http://localhost:3000/mcp" }
  }
}
```

A única tool inicial é `health_check`. O MCP permanece desabilitado por padrão
até a validação do fluxo OAuth 2.1 com `resource` e audience; habilite
`MCP_ENABLED=true` somente em prova local controlada.

## Comandos

`pnpm dev`, `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm format`,
`pnpm typecheck`, `pnpm infra:up`, `pnpm infra:down`, `pnpm infra:logs`,
`pnpm supabase:start`, `pnpm supabase:status`, `pnpm supabase:stop`,
`pnpm db:generate`, `pnpm db:migrate`, `pnpm db:studio` e `pnpm db:reset`.

Para criar e validar módulos da API, use `pnpm module:create <nome>` e
`pnpm architecture:check`.

## Troubleshooting

- Se a porta estiver ocupada, encerre o processo que usa 3000, 5173, 54321 a
  54324, 9000 ou 9001.
- Se a API falhar na inicialização, confirme que `.env` existe e que
  `pnpm infra:up` terminou com os containers saudáveis.
- Não use `supabase stop --no-backup` nem `supabase db reset` sem confirmar que
  os dados locais podem ser descartados.
