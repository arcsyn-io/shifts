# Stack tecnológica

## Finalidade

Este documento registra a stack adotada pelo ArcSyn Shift e as regras para sua
evolução. Ele descreve a baseline atual do repositório; não é um catálogo de
tecnologias permitidas por conveniência.

Os arquivos `package.json` definem as faixas de versão declaradas. O
`pnpm-lock.yaml` define as resoluções exatas instaladas e deve permanecer
sincronizado com os manifests.

## Runtime e monorepo

- Node.js 20 ou superior como runtime de desenvolvimento e execução.
- pnpm 9.15.5 como gerenciador de pacotes declarado em `packageManager`.
- pnpm workspaces para organizar aplicações e pacotes internos.
- Turborepo 2 para coordenar desenvolvimento, build, lint, testes e typecheck.
- TypeScript 5.7 como linguagem principal.
- ECMAScript Modules, com `type: module` nos pacotes executáveis.
- Target ES2022 e resolução `NodeNext` na configuração compartilhada.
- TypeScript estrito, incluindo `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes` e `noImplicitOverride`.
- tsx 4 para execução e recarregamento dos processos TypeScript em
  desenvolvimento.

Não introduza npm, Yarn, Nx ou outro orquestrador em paralelo.

## Aplicação web

A aplicação web reside em `apps/web` e utiliza:

- React 18 para composição da interface;
- React DOM 18 para renderização no navegador;
- Vite 6 para servidor de desenvolvimento e build;
- React Router 7 para navegação;
- TanStack Query 5 para estado remoto, cache e sincronização;
- React Hook Form 7 para estado e interação de formulários;
- Zod 3 para validação e interpretação de dados nas fronteiras;
- `@arcsyn-io/react` 0.1 como adaptador React obrigatório do ArcSyn Design
  System, distribuído pelo GitHub Packages.

Não adicione soluções concorrentes para roteamento, estado remoto, formulários
ou validação sem decisão arquitetural aprovada. Estado estritamente local da
interface deve continuar próximo do componente que o utiliza.

## API

A API reside em `apps/api` e utiliza:

- NestJS 11 para módulos, composição e injeção de dependências;
- Fastify 5 como adaptador HTTP;
- NestJS Swagger 8 para documentação do contrato HTTP;
- RxJS 7 e Reflect Metadata como dependências do runtime NestJS;
- adaptadores HTTP e MCP sobre os mesmos serviços de aplicação;
- os pacotes compartilhados de contratos, configuração, banco e observabilidade.

Fastify é o adaptador HTTP adotado. Não introduza Express ou outro servidor em
paralelo. Controllers HTTP e adaptadores MCP não devem conter regras de negócio.

## Contratos e configuração

- `packages/contracts` concentra esquemas e tipos compartilhados com Zod 3.
- `packages/config` concentra leitura e validação de configuração com Zod 3.
- Pacotes internos usam o protocolo `workspace:*`.
- Consumidores importam apenas as exportações públicas dos pacotes.

Não duplique manualmente o mesmo contrato no frontend e no backend. Não leia
variáveis de ambiente de forma dispersa quando a configuração puder ser
centralizada e validada.

## Persistência e armazenamento local

- PostgreSQL 16 Alpine é o banco relacional do ambiente local.
- Drizzle ORM 0.38 é a camada de acesso e modelagem relacional.
- Drizzle Kit 0.30 gera e aplica migrações.
- node-postgres 8 fornece o driver PostgreSQL.
- MinIO fornece armazenamento de objetos compatível com S3 no ambiente local.
- Docker Compose coordena PostgreSQL, MinIO e sua inicialização local.

As imagens MinIO ainda usam a tag `latest` no ambiente local. Isso não constitui
uma versão aprovada para produção. Uma estratégia de produção deve fixar versões
e passar por revisão operacional e de segurança.

## Observabilidade

`packages/observability` utiliza Pino 9 para logs estruturados. Aplicações não
devem introduzir outro logger por conta própria.

Backend de métricas, traces, armazenamento de logs, alertas e SLOs ainda não
foram definidos. Essas escolhas dependem de requisitos operacionais e não devem
ser inferidas a partir do pacote atual.

## Qualidade e automação local

- Vitest 2 é o executor de testes adotado.
- ESLint 9 com typescript-eslint 8 realiza análise estática.
- Prettier 3 realiza formatação.
- Husky 9 gerencia hooks Git locais.
- lint-staged 15 aplica tarefas somente aos arquivos preparados para commit.

Não introduza um segundo executor de testes, linter ou formatador sem uma
necessidade demonstrada e decisão aprovada.

## Política de dependências e versões

- Use sempre `pnpm` para instalar, remover ou atualizar dependências.
- Declare dependências no menor pacote que efetivamente as utiliza.
- Mantenha na raiz apenas ferramentas transversais ao monorepo.
- Use `workspace:*` para dependências internas.
- Nunca edite o lockfile manualmente.
- Atualize manifest e lockfile na mesma alteração.
- Não realize atualização principal como efeito colateral de outra tarefa.
- Avalie compatibilidade, manutenção, segurança, licença, tamanho e custo
  operacional antes de adicionar uma dependência.
- Prefira capacidades já presentes na stack antes de adicionar alternativas.

Adicionar uma biblioteca auxiliar não exige automaticamente uma ADR. Exige ADR
quando introduzir ou substituir uma capacidade estrutural, protocolo, banco,
framework, runtime, provedor ou limite arquitetural.

## Decisões ainda não tomadas

Não há decisão aprovada no repositório para:

- estratégia de processamento assíncrono, caso essa capacidade seja necessária;
- orquestração de contêineres em produção;
- pipeline de CI/CD;
- provedor de identidade externo, MFA e recuperação pública de conta; a sessão
  web local foi definida na
  [ADR-0003](decisions/0003-sessao-web-jwt-cookie-http-only.md);
- backend de métricas, traces, logs e alertas;
- ferramenta de testes de navegador ou ponta a ponta;
- estratégia de feature flags;
- serviço de armazenamento de objetos em produção.

Essas lacunas devem permanecer explícitas até que requisitos e restrições
justifiquem uma decisão. Não escolha tecnologias para preenchê-las sem
aprovação.

## Evolução da stack

Antes de propor uma mudança:

1. Demonstre por que a stack atual não atende ao requisito.
2. Identifique alternativas, incluindo não adicionar tecnologia.
3. Avalie impacto em segurança, operação, testes, migração e capacitação.
4. Defina compatibilidade, adoção gradual e estratégia de retorno.
5. Crie uma ADR quando a decisão for estrutural ou difícil de reverter.
