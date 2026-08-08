# Supabase Auth local

## Finalidade

O ambiente local usa a CLI fixada no workspace para iniciar PostgreSQL 17,
Supabase Auth, gateway, Studio e o servidor de email local. A stack possui
credenciais de desenvolvimento, não oferece o hardening de produção e deve
permanecer acessível somente pelo host.

## Inicialização

```bash
pnpm install
cp .env.example .env
pnpm supabase:check
pnpm infra:up
pnpm db:migrate
pnpm auth:seed
pnpm supabase:status
pnpm dev
```

`pnpm infra:up` inicia primeiro a stack Supabase e depois o MinIO. O Drizzle
aplica as migrations da aplicação no banco `postgres`, porta `54322`. A CLI
administra os schemas internos do Supabase; as migrations Drizzle não podem
alterar o schema `auth`.

`pnpm auth:seed` usa temporariamente a credencial administrativa emitida pela
CLI, sem gravá-la em arquivo, para criar de forma idempotente o usuário local
`usuario.local@shifts.invalid` com a senha exclusiva de desenvolvimento
`LocalOnly-ChangeMe123!`. Use `SUPABASE_SEED_EMAIL` e `SUPABASE_SEED_PASSWORD`
apenas em um `.env` ignorado se precisar sobrescrever esses valores.

## Reset reproduzível

Com a stack saudável, o comando abaixo recria o banco local, aplica as
migrations Drizzle e então repõe o usuário de teste:

```bash
pnpm infra:reset
```

Esse comando é destrutivo para os dados locais e só deve ser executado com
autorização explícita. As migrations internas continuam sob responsabilidade da
CLI; as tabelas da aplicação continuam sob responsabilidade do Drizzle.

`pnpm supabase:check` valida a versão da CLI, a configuração mínima, a ausência
do PostgreSQL legado no Compose, o bind local do MinIO e as proteções de dados.
O check é estático: ele não inicia containers nem comprova saúde dos serviços.
Os comandos `supabase:start` e `supabase:status` removem chaves administrativas
da saída antes de escrevê-la no terminal; a chave publicável permanece visível.

Antes da primeira subida, `pnpm infra:up` cria a Docker network externa
`shifts-supabase` com `com.docker.network.bridge.host_binding_ipv4=127.0.0.1`.
As portas publicadas pela CLI ficam, assim, acessíveis somente no host. Se já
existir uma rede com o mesmo nome e outra configuração, o comando falha sem
removê-la ou recriá-la.

## Endpoints

- API, Auth e discovery: `http://127.0.0.1:54321`
- PostgreSQL da aplicação:
  `postgresql://arcsyn_shift_app_local:arcsyn_shift_local@127.0.0.1:54322/postgres`
- PostgreSQL de migrações:
  `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Studio: `http://127.0.0.1:54323`
- emails locais: `http://127.0.0.1:54324`
- web: `http://localhost:5173`
- API ArcSyn Shift: `http://localhost:3000`

As credenciais acima pertencem exclusivamente à stack local. Nunca reutilize
esses valores em Preview, Production ou um projeto Supabase remoto.

O arquivo `supabase/roles.sql` provisiona o login local sem privilégios e o faz
membro de `arcsyn_shift_runtime`. `infra:up` e `infra:reset` executam o script
idempotente `db:roles:local`, restrito ao host e à porta do Supabase local. A
API usa esse login; somente migrações usam a credencial administrativa. Em
ambientes remotos, provisione uma senha forte no secret store e conceda a mesma
role de grupo, sem copiar a senha local.

## Auth e OAuth

O ambiente bloqueia cadastro público globalmente, mas mantém o provedor de
email/senha disponível para o usuário criado pelo seed. Também habilita
confirmação de email, troca segura de senha, rotação de refresh token e o OAuth
Server. A tela de autorização futura usará
`http://localhost:5173/oauth/consent`.

Dynamic Client Registration permanece desabilitado. Clientes MCP devem ser
pré-cadastrados durante a prova de compatibilidade. `MCP_ENABLED` permanece
`false` até comprovar PKCE S256, `resource`, audience, discovery e JWKS.

O spike local de 2026-08-05 completou Authorization Code com PKCE S256, mas o
Supabase Auth 2.194.0 ignorou `resource=http://localhost:3000/mcp` nos detalhes
da autorização e emitiu `aud=authenticated`. Portanto o MCP da aplicação deve
continuar desabilitado até um Custom Access Token Hook produzir e a API validar
uma audience específica do recurso, ou até ser aprovada outra solução.

A versão 2.111.0 da CLI também publica, junto ao Studio, um endpoint MCP local
de administração do Supabase em `http://127.0.0.1:54321/mcp`. Ele é distinto do
`/mcp` da aplicação e permanece restrito ao host pela Docker network dedicada. A
CLI não oferece uma opção específica para desabilitar esse endpoint sem retirar
o Studio; por isso, não o registre em clientes MCP e nunca exponha a stack fora
do host. `MCP_ENABLED=false` controla somente o MCP do ArcSyn Shift.

## Segredos

- não versione secret key, `service_role`, JWT secret, private JWK, tokens da
  CLI, segredos de provedores, authorization codes ou PKCE verifiers;
- use `env(...)` no `supabase/config.toml` para qualquer segredo futuro;
- nunca use prefixo `VITE_` para uma credencial administrativa;
- copie a chave publicável exibida por `pnpm supabase:status` somente para
  `SUPABASE_PUBLISHABLE_KEY`; ela não substitui `service_role` e não concede
  acesso administrativo;
- `supabase/signing_keys.json`, `.temp`, `.branches` e arquivos locais de env
  estão ignorados.

## Encerramento e dados

```bash
pnpm infra:down
```

O comando preserva os dados locais do Supabase. Não execute
`supabase stop --no-backup`, `supabase db reset` nem remova volumes sem
aprovação explícita, pois essas ações descartam dados.

Se `pnpm infra:up` falhar depois de iniciar apenas parte dos serviços, não rode
`docker compose down -v`, `docker volume rm` ou `supabase stop --no-backup`.
Inspecione primeiro `docker ps -a` e `pnpm supabase:status`; preserve os volumes
e a network `shifts-supabase`, e escale o diagnóstico antes de qualquer limpeza.

## Diagnóstico do Docker

Se o Docker retornar erro ao criar uma interface `veth`, confirme se os módulos
do kernel ativo estão instalados:

```bash
uname -r
modinfo veth
```

Quando o kernel foi atualizado e `/usr/lib/modules/$(uname -r)` não existe, é
necessário reiniciar o host no kernel instalado antes de subir a stack. Reinicie
somente depois de salvar o trabalho e encerrar processos importantes. Até esse
retorno estar disponível, `pnpm supabase:check` continua sendo a validação
segura possível; `pnpm infra:up`, migrations e health checks permanecem
pendentes.
