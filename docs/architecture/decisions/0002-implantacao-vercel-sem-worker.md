# ADR-0002: Implantação do MVP na Vercel sem worker

- **Status:** Aceita
- **Data:** 2026-08-01
- **Responsáveis:** equipe de desenvolvimento do ArcSyn Shift
- **Funcionalidade relacionada:** implantação inicial do MVP

## Contexto

O monorepo possui uma aplicação web React/Vite, uma API NestJS/Fastify e um
processo `apps/worker`. O worker apenas inicializa uma conexão com PostgreSQL e
não executa filas, agendamentos, eventos ou regras de negócio. O MVP não exige
processamento assíncrono.

A Vercel oferece suporte direto a Vite e converte uma aplicação NestJS em uma
Function. O repositório precisa preservar desenvolvimento local, os contratos
HTTP e MCP e a organização em pnpm workspaces.

## Decisão proposta

- Implantar `apps/web` e `apps/api` como projetos Vercel independentes ligados
  ao mesmo monorepo.
- Usar `apps/web` e `apps/api` como os respectivos Root Directories.
- Executar a API em Fluid Compute na região `gru1`.
- Remover `apps/worker` sem substituto no MVP.
- Manter migrações como etapa separada do build e do bootstrap da API.
- Não disponibilizar credenciais de migração ou S3 ao runtime da API.
- Manter o endpoint MCP desabilitado em Preview e Production até que possua
  autenticação, autorização por ferramenta e limitação de uso.
- Usar `VITE_API_URL` enquanto o domínio definitivo da API não estiver definido.
- Encaminhar `/api/*` pelo mesmo origin do web somente depois que existir um
  alias estável da API; essa configuração não deve conter URL fictícia.

## Consequências

### Positivas

- Menos processos e menor custo operacional no MVP.
- Deploy e rollback independentes para web e API.
- Builds de monorepo permanecem compatíveis com pnpm e Turborepo.
- A região da API pode ficar próxima ao banco de produção.

### Negativas

- Preview deployments de web e API não são pareados automaticamente.
- Até a definição do proxy, web e API usam origins distintos e exigem CORS.
- A API fica sujeita aos limites de tamanho e duração das Vercel Functions.
- Uma futura necessidade de processamento contínuo exigirá nova decisão.

## Riscos e mitigações

- Usar pool de conexões apropriado para runtime serverless e manter uma URL
  separada para migrações.
- Não executar migrações automaticamente durante cada build ou cold start.
- Configurar segredos somente nos ambientes da Vercel, nunca no repositório.
- Proteger previews e marcar valores sensíveis no dashboard da Vercel.
- Validar `/api/health`, `/api/docs` e `/mcp` em Preview antes da promoção.
- Registrar uma nova ADR antes de introduzir fila, agendador ou worker.

## Plano de adoção

1. Adicionar configuração Vercel em cada aplicação.
2. Remover `apps/worker` e atualizar o lockfile.
3. Criar os dois projetos Vercel com Node.js 22.
4. Configurar variáveis por ambiente e publicar primeiro a API.
5. Configurar `VITE_API_URL` e publicar o web.
6. Validar as rotas públicas e o fallback da SPA.
7. Definir domínios e o proxy same-origin antes da autenticação por cookie.

## Critérios de revisão

Reavaliar esta decisão quando houver processamento assíncrono, conexões
persistentes incompatíveis com Functions, exigência de rede privada ou limites
operacionais que justifiquem outro runtime.

## Emenda operacional de 2026-08-05

A autenticação por cookie tornou o proxy same-origin um requisito de deploy. A
configuração web migra de `vercel.json` estático para `vercel.ts` programático e
obtém de `API_PROXY_ORIGIN` o alias HTTPS estável da API em cada environment.
Isso substitui o uso de `VITE_API_URL` descrito na decisão e no plano de adoção,
sem alterar a topologia de dois projetos independentes.

O origin é validado durante a avaliação da configuração e um valor ausente ou
inválido interrompe o deployment. Preview continua sem pareamento automático:
cada environment deve apontar somente para API, Supabase e banco isolados do
ambiente de Production.
