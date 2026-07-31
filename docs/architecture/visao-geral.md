# Visão geral da arquitetura

## Estrutura do monorepo

- `apps/api`: API NestJS com Fastify e adaptadores de apresentação HTTP e MCP.
- `apps/web`: aplicação web React construída com Vite.
- `apps/worker`: processamento em segundo plano com NestJS.
- `packages/contracts`: contratos e esquemas compartilhados.
- `packages/database`: esquema, cliente e migrações do PostgreSQL com Drizzle.
- `packages/config`: leitura e validação centralizada de configuração.
- `packages/observability`: recursos compartilhados de logs e observabilidade.
- `packages/typescript-config`: configurações TypeScript compartilhadas.
- `infra`: recursos de infraestrutura para o ambiente local.

## Regras arquiteturais

- Reutilize os pacotes compartilhados existentes antes de duplicar contratos,
  configuração, acesso a dados ou observabilidade nas aplicações.
- Mantenha regras de negócio fora dos adaptadores HTTP e MCP. Adaptadores podem
  traduzir transporte e protocolo, mas devem compartilhar os mesmos serviços de
  aplicação.
- Defina contratos compartilhados em `packages/contracts`; não mantenha cópias
  independentes do mesmo formato no frontend e no backend.
- Centralize acesso e evolução do esquema de dados em `packages/database`.
- Toda alteração persistente de esquema deve possuir uma migração revisável.
- Valide entradas externas e configurações nas fronteiras do sistema.
- Mantenha as dependências entre aplicações e pacotes explícitas. Não crie
  importações por caminhos internos de outro pacote.
- Mudanças em fronteiras, propriedade de dados, contratos públicos, comunicação
  entre processos ou tecnologia estrutural exigem análise arquitetural.

As decisões que alterarem estas regras devem seguir o processo de ADR descrito
em [Fluxo de especificações e ADRs](../specifications/fluxo-e-adrs.md).
