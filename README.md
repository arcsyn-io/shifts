# ArcSyn Shift

Configuração inicial do monorepo, sem regras de negócio, entidades ou casos de uso do produto.

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
pnpm dev
```

Serviços locais:

- Web: http://localhost:5173
- API health: http://localhost:3000/api/health
- Swagger: http://localhost:3000/api/docs
- MCP: http://localhost:3000/mcp
- MinIO Console: http://localhost:9001 (`minio` / `miniosecret`)

O PostgreSQL cria o banco `arcsyn_shift`, as roles `arcsyn_shift_migration` e `arcsyn_shift_application`, e o MinIO cria automaticamente o bucket `arcsyn-shift-local`.

## MCP

O adaptador MCP vive dentro de `apps/api` e compartilha o `HealthService` com o adaptador HTTP. A configuração mínima é:

```json
{
  "mcpServers": {
    "arcsyn-shift": { "url": "http://localhost:3000/mcp" }
  }
}
```

A única tool inicial é `health_check`. O adaptador pode ser desabilitado com `MCP_ENABLED=false`.

## Comandos

`pnpm dev`, `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm format`, `pnpm typecheck`, `pnpm infra:up`, `pnpm infra:down`, `pnpm infra:logs`, `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:studio` e `pnpm db:reset`.

## Troubleshooting

- Se a porta estiver ocupada, encerre o processo que usa 3000, 5173, 5432, 9000 ou 9001.
- Se as roles do PostgreSQL não aparecerem após alterar as credenciais, rode `pnpm infra:down` e remova o volume local antes de subir novamente.
- Se a API falhar na inicialização, confirme que `.env` existe e que `pnpm infra:up` terminou com os containers saudáveis.
