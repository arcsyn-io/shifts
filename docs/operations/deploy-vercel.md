# Deploy na Vercel

## Estado do proxy same-origin

O login web depende de `/api/*` no mesmo origin visível no navegador. O projeto
web e o projeto API são independentes, portanto esse caminho exige um rewrite
externo antes do fallback da SPA. `apps/web/vercel.ts` gera a configuração no
build a partir de `API_PROXY_ORIGIN`:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "${API_PROXY_ORIGIN}/api/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

O trecho ilustra o resultado gerado; `${API_PROXY_ORIGIN}` não é interpolado em
JSON estático. A configuração programática valida a variável como origin HTTPS
exato, sem credenciais, path, query, fragment ou barra final. O build falha se a
variável estiver ausente ou inválida. O rewrite preserva o prefixo `/api`,
precede o fallback da SPA e não habilita cache CDN para respostas do upstream.

O responsável pelo deploy deve obter os aliases HTTPS estáveis de Production e
homologação e configurar `API_PROXY_ORIGIN` separadamente em cada environment.
Até essa variável existir e os smoke tests passarem, autenticação web não está
liberada no environment correspondente.

## Topologia

Crie dois projetos Vercel a partir do mesmo repositório:

| Projeto | Root Directory | Framework | Região     |
| ------- | -------------- | --------- | ---------- |
| Web     | `apps/web`     | Vite      | CDN global |
| API     | `apps/api`     | NestJS    | `gru1`     |

Use Node.js 22 nos dois projetos. A Vercel reconhece o `pnpm-lock.yaml` da raiz
e os pacotes `workspace:*`. Mantenha habilitada a inclusão de arquivos externos
ao Root Directory para que os pacotes compartilhados sejam construídos.

A API usa a detecção zero-config do NestJS e não deve possuir Build Command ou
Output Directory customizados. O `installCommand` versionado usa a versão de
pnpm fixada pelo repositório, instala com lockfile congelado somente a raiz de
ferramentas e a closure da API e usa o grafo do Turborepo para construir esses
pacotes antes do builder da Vercel. O projeto web mantém no `vercel.ts` seu
build filtrado a partir da raiz e seu proxy parametrizado.

## Ordem de configuração

1. Crie projetos Supabase distintos para homologação e Production.
2. Importe o projeto da API e configure suas variáveis por ambiente.
3. Execute as migrações em uma etapa protegida e separada do deploy.
4. Publique a API e valide seu alias HTTPS estável diretamente.
5. Importe o projeto web e configure somente suas variáveis de build.
6. Configure `API_PROXY_ORIGIN` com o alias estável aprovado para o proxy.
7. Publique o web e execute os smoke tests pelo origin do web.
8. Promova somente após todos os gates deste runbook passarem.

Nos ambientes Preview e Production do projeto web, configure `NODE_AUTH_TOKEN`
como Sensitive para baixar os pacotes `@arcsyn-io/*` do GitHub Packages. Use um
PAT classic com somente o escopo `read:packages`, preferencialmente de uma conta
técnica, com expiração e rotação definidas. Não disponibilize esse token ao
projeto da API.

## Variáveis da API

Configure a lista abaixo no projeto API. Os origins não levam barra final.

| Variável                   | Valor e finalidade                               | Tratamento |
| -------------------------- | ------------------------------------------------ | ---------- |
| `NODE_ENV`                 | `production` em Preview e Production             | Plaintext  |
| `DATABASE_URL`             | Pooler do banco do ambiente, com role de runtime | Sensitive  |
| `WEB_URL`                  | Origin HTTPS exato do web do ambiente            | Plaintext  |
| `API_URL`                  | Origin HTTPS do alias real da API do ambiente    | Plaintext  |
| `SUPABASE_URL`             | URL do projeto Supabase do ambiente              | Plaintext  |
| `SUPABASE_PUBLISHABLE_KEY` | Chave publishable do projeto do ambiente         | Sensitive  |
| `MCP_ENABLED`              | `false`                                          | Plaintext  |
| `LOG_LEVEL`                | `info`, salvo diagnóstico temporário aprovado    | Plaintext  |

`SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` são obrigatórias para o módulo de
autenticação, mesmo com `MCP_ENABLED=false`. Não configure `SUPABASE_ISSUER`,
`SUPABASE_JWKS_URL`, `SUPABASE_AUDIENCE` nem `MCP_RESOURCE_URI` enquanto o MCP
permanecer desabilitado.

`PORT` é fornecida pela Vercel. `API_PORT` permanece como fallback local e não
precisa ser definida na plataforma. Não use valores fictícios para variáveis
obrigatórias e não exponha segredos com o prefixo `VITE_`.

`DATABASE_URL` deve usar o pooler recomendado pelo provedor para Functions. A
credencial deve pertencer a uma role de aplicação com mínimo privilégio.

`DATABASE_MIGRATION_URL` pertence exclusivamente à etapa protegida de migração:
não a configure no projeto Vercel da API. A role de migração deve ser distinta
da role de runtime. Também não configure `SUPABASE_SECRET_KEY`, `service_role`,
JWT secret, private JWK ou credenciais S3 no runtime. Preview e Production devem
usar projetos Supabase, roles e bancos distintos. Marque os valores indicados
como Sensitive no dashboard e mantenha responsáveis, expiração e procedimento de
rotação.

O MCP permanece desabilitado em Preview e Production. Antes de habilitá-lo,
implemente autenticação, autorização por ferramenta e rate limit; configure
budgets e alertas de uso para evitar abuso e custo inesperado.

## Variáveis do web

- `NODE_AUTH_TOKEN`: PAT classic Sensitive, com somente `read:packages`, para
  instalar os pacotes privados `@arcsyn-io/*`.
- `API_PROXY_ORIGIN`: origin HTTPS exato da API do mesmo ambiente, sem barra
  final; por exemplo, o alias estável registrado no projeto API.

Não configure `VITE_API_URL` no modo proxy. O navegador deve consumir somente
`/api/*` no origin do web. Nunca exponha `SUPABASE_SECRET_KEY`, `service_role`,
JWT secret, private JWK ou outro segredo com prefixo `VITE_`.

Uma alteração de environment variable afeta somente novos deployments. Faça um
novo deploy e repita os smoke tests após qualquer inclusão, rotação ou remoção.

## Preview deployments

Web e API são projetos independentes. Um preview do web não descobre
automaticamente o preview correspondente da API. `API_PROXY_ORIGIN` permite
selecionar um alias por environment, mas não cria nem pareia deployments. Não
aponte Preview para o alias de Production.

Antes de liberar autenticação em Preview, aprove uma destas topologias e
registre os aliases concretos correspondentes:

- web e API de homologação com aliases estáveis, Supabase e banco próprios;
- configuração de Preview por branch com aliases explícitos e revisados; ou
- pareamento gerenciado de serviços, mediante revisão arquitetural.

Em qualquer opção, `WEB_URL` deve ser o origin exato do web que inicia o login e
o proxy deve encaminhar ao projeto API do mesmo ambiente. Previews efêmeros sem
pareamento permanecem adequados apenas para verificações que não dependam de
sessão.

Ative Vercel Authentication ou Standard Protection nos previews e valide o
bloqueio também em uma janela anônima. Essa proteção não substitui a
autenticação da aplicação.

Configure no Vercel Firewall uma baseline inicial, com regras específicas antes
da regra geral:

| Rota                | Método   | Limite inicial por IP |
| ------------------- | -------- | --------------------: |
| `/api/auth/login`   | `POST`   |                 5/min |
| `/api/auth/session` | `GET`    |                60/min |
| `/api/auth/session` | `DELETE` |                10/min |
| `/api/*`            | qualquer |               300/min |

Calibre esses valores com tráfego legítimo observado e objetivo de recuperação,
mantendo responsável e procedimento de desbloqueio. O gate exige `429` para
rajadas e comprovação de que logins normais continuam funcionando. Não registre
email, senha, cookies ou tokens nos eventos do Firewall ou logs.

Repita a proteção no projeto API, pois `Origin` pode ser forjado por clientes
HTTP que contornem o web. Antes de aplicar o mesmo limite estrito, confirme qual
IP a Vercel usa como chave após o rewrite externo. Se todos os requests chegarem
com o IP do proxy, use um circuit breaker mais amplo na API para evitar um
bloqueio coletivo e encaminhe ingress autenticado ou privado para decisão
arquitetural.

Não aponte previews para o banco de produção. Migrações permanecem fora do build
da Vercel.

## Validação e retorno

Antes de promover uma versão:

1. confirme o build dos dois projetos;
2. teste `GET https://<web-origin>/api/health` e confirme `200`;
3. abra `https://<web-origin>/api/docs` e confirme o contrato esperado;
4. confirme que `https://<api-origin>/mcp` retorna `404` com
   `MCP_ENABLED=false`;
5. recarregue uma rota React que não seja `/` e confirme o fallback da SPA;
6. envie login inválido por `POST /api/auth/login` e confirme `401`, resposta
   sem detalhes internos e `Cache-Control: private, no-store`;
7. faça login com um usuário de smoke test do ambiente, confirme `200`, cookie
   `Secure` e `HttpOnly` e ausência de token no body ou storage do navegador;
8. recarregue a página, confirme a restauração da sessão e execute logout;
9. confirme que a sessão anterior recebe `401` depois do logout;
10. teste um `Origin` não permitido e confirme rejeição;
11. confirme que as respostas de autenticação não foram armazenadas pelo CDN;
12. confirme que nenhuma chave, senha, cookie ou token aparece no bundle, nos
    logs ou nos artefatos;
13. exercite o rate limit do login com dados sintéticos e confirme o alerta ou
    evento operacional esperado.

Execute os testes 2, 3 e 5 a 13 pelo origin do web; isso comprova o rewrite, e
não somente a disponibilidade direta da API. Registre deployment IDs, horário,
ambiente e resultado, mas nunca credenciais ou conteúdo de cookies/tokens.

O usuário de smoke test deve ser criado por convite ou administração no projeto
Supabase do ambiente. Não execute `pnpm auth:seed` fora do ambiente local. Antes
de fluxos de convite, confirmação ou recuperação, configure SMTP próprio,
política de senha, `Site URL` e Redirect URLs exatas do web no Supabase.

Confirme ainda que Postgres está na região operacional escolhida para a API. A
região única `gru1` não possui failover definido nesta fase. O Swagger deve ser
reavaliado antes da promoção, pois agora documenta contratos protegidos.

Em caso de falha, interrompa a promoção e use Instant Rollback para retornar ao
deployment anterior. Se o problema for o proxy, restaure o deployment web
anterior; isso pode encerrar sessões e exigir novo login. Alterações de
environment variables exigem novo deployment com os valores anteriores.

Migrações de banco têm plano de retorno próprio, devem ser compatíveis com as
duas versões durante a janela de deploy e nunca são revertidas automaticamente
junto com o código. Escalone falhas de login, cache de resposta autenticada,
vazamento de segredo ou cruzamento de sessão ao responsável de segurança antes
de qualquer nova promoção.
