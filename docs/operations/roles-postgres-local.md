# Roles do PostgreSQL local

## Objetivo e limites

O ambiente local usa credenciais diferentes para três responsabilidades:

| Role                        | Responsabilidade                        |
| --------------------------- | --------------------------------------- |
| `arcsyn_shift_migration`    | schema, migrações e aplicação de grants |
| `arcsyn_shift_application`  | runtime da API                          |
| `arcsyn_shift_provisioning` | provisionamento e desativação de contas |

Os valores presentes em `.env.example` e `infra/postgres/init/01-roles.sql` são
exclusivos do PostgreSQL local. Não os reutilize em homologação ou produção.
Nesses ambientes, injete credenciais distintas pelo mecanismo de segredos
aprovado e mantenha a credencial de migração fora do runtime da API.

A role runtime pode consultar `users`, mas não pode inserir, alterar ou excluir
contas. Ela possui escrita somente nas tabelas de refresh token e rate limit
necessárias aos fluxos da API. A role de provisionamento pode ler somente o
identificador e o email, inserir email e hash de senha e alterar os campos
administrativos previstos. Ela não pode ler hashes, excluir contas nem acessar
tabelas de sessão ou rate limit.

## Banco local novo

Pré-condições:

- Docker Compose iniciado com o arquivo do repositório;
- PostgreSQL saudável;
- variáveis locais carregadas sem registrar seus valores em logs.

O entrypoint do PostgreSQL executa `infra/postgres/init/01-roles.sql` somente ao
criar um volume vazio. Depois de criar ou atualizar o schema, aplique os grants
explícitos:

```bash
pnpm db:migrate
docker compose exec -T postgres psql \
  --set=ON_ERROR_STOP=1 \
  --username arcsyn_shift_migration \
  --dbname arcsyn_shift \
  < infra/postgres/access/01-auth-roles.sql
```

Resultado esperado: migrações concluídas e `COMMIT` no script de grants. O
script falha e reverte se alguma tabela esperada ainda não existir.

## Volume local existente

Não remova o volume para adotar as novas roles. Crie ou reconcilie as roles e
depois aplique os grants, preservando os dados:

```bash
docker compose exec -T postgres psql \
  --set=ON_ERROR_STOP=1 \
  --username arcsyn_shift_migration \
  --dbname arcsyn_shift \
  < infra/postgres/init/01-roles.sql
docker compose exec -T postgres psql \
  --set=ON_ERROR_STOP=1 \
  --username arcsyn_shift_migration \
  --dbname arcsyn_shift \
  < infra/postgres/access/01-auth-roles.sql
```

Em PowerShell, substitua a entrada redirecionada por
`Get-Content -Raw <arquivo> | docker compose exec -T postgres psql ...`.

## Verificação

Execute a verificação depois dos grants:

```bash
docker compose exec -T postgres psql \
  --set=ON_ERROR_STOP=1 \
  --username arcsyn_shift_migration \
  --dbname arcsyn_shift \
  < infra/postgres/verify/01-auth-roles.sql
```

O resultado esperado é `roles de auth validadas`. A verificação falha se a role
runtime puder escrever em `users`, se a role de provisionamento acessar tabelas
de sessão/rate limit ou se qualquer uma possuir atributos elevados.

Reaplique o arquivo de grants, com revisão, depois de cada migração que crie ou
altere tabelas usadas pela API. Não conceda default privileges amplos para
contornar uma falha de permissão.

## Provisionamento local

O comando administrativo lê exclusivamente `DATABASE_PROVISIONING_URL`; ele não
carrega a configuração nem as credenciais do runtime da API:

```bash
pnpm --filter @arcsyn-shift/api auth:provision usuario@exemplo.local
```

A senha é solicitada interativamente e não deve ser passada como argumento. A
API em execução continua usando `DATABASE_URL` com a role
`arcsyn_shift_application`. Não disponibilize `DATABASE_PROVISIONING_URL` nem
`DATABASE_MIGRATION_URL` ao processo do servidor da API.

## Retorno e escalonamento

As novas roles e grants não alteram dados de negócio. Em caso de falha de
permissão, não eleve a role runtime nem substitua sua URL pela credencial de
migração. Identifique a operação SQL negada, atualize o arquivo de grants com o
menor privilégio necessário, revise e reaplique.

Se uma migração exigir novos acessos ou se o provisionamento precisar excluir
contas, interrompa a operação e encaminhe a mudança para revisão de segurança e
de requisitos. Exclusão de contas e grants de produção não fazem parte deste
procedimento local.
