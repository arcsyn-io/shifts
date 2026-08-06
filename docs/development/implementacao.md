# Convenções de implementação

## Regras gerais

- Use `pnpm` para dependências e scripts.
- Respeite os módulos ES e as configurações TypeScript compartilhadas.
- Evite `any`, coerções inseguras e tratamento silencioso de erros.
- Não introduza dependências sem justificar necessidade, alternativas e custo.
- Não edite manualmente um arquivo gerado quando houver um comando oficial para
  regenerá-lo.
- Ao alterar comportamento, adicione ou atualize testes no nível mais próximo
  capaz de verificá-lo.

## Backend

Use o gerador e o validador descritos em
[Criação e validação de módulos da API](modulos-api.md).

- Organize capacidades da API em `src/modules/<modulo>`.
- Cada módulo contém `application`, `presentation`, `domain` e `repository`,
  além de `<modulo>.module.ts`.
- `application` contém services e coordena domínio e persistência.
- Commands independentes de transporte ficam em `application/commands` e os
  resultados da aplicação ficam em `application/results`.
- `presentation` contém controllers HTTP e ferramentas ou handlers MCP.
- DTOs e mappers pertencem ao protocolo que representam, em
  `presentation/http/dto`, `presentation/http/mappers`, `presentation/mcp/dto`
  ou `presentation/mcp/mappers`.
- A apresentação MCP pode implementar o contrato técnico compartilhado pelo
  agregador em `infrastructure/mcp`, sem importar implementações do transporte.
- `domain` contém objetos de domínio e use cases sem dependência de NestJS,
  transporte ou persistência.
- Use cases, entidades e value objects ficam, respectivamente, em
  `domain/use-cases`, `domain/entities` e `domain/value-objects`.
- `repository` contém contratos e implementações de acesso a dados do módulo.
- Mappers entre persistência e domínio ficam em `repository/mappers`.
- Infraestrutura usada por vários módulos permanece em `src/infrastructure`.
- A direção principal é `presentation` → `application` → `domain`/`repository`.
- Módulos não importam caminhos internos de outros módulos; colaboração exige
  uma exportação pública explícita.
- Mantenha regras de negócio fora de controllers e adaptadores de protocolo.
- Services recebem Commands e retornam Results da aplicação; não recebem nem
  retornam DTOs de HTTP ou MCP.
- Mapeamentos não triviais devem ser puros e permanecer na fronteira que
  conhecem. Não concentre mapeamentos de transporte e persistência em
  controllers ou services.
- Use `packages/contracts` para contratos compartilhados, `packages/database`
  para persistência, `packages/config` para configuração e
  `packages/observability` para logs e telemetria.
- Valide entradas externas e aplique autorização na fronteira apropriada.

## Frontend

- Implemente interfaces com abordagem **mobile first**: comece pelo menor
  viewport suportado e adicione complexidade progressivamente por breakpoints,
  sem depender de uma versão desktop reduzida posteriormente.
- Garanta conteúdo e ações principais sem rolagem horizontal acidental, preserve
  ordem semântica ao reorganizar layouts e ofereça alvos de toque, espaçamento e
  feedback adequados para interação por dedos.
- Não duplique formatos de contratos compartilhados.
- Inclua estados de carregamento, vazio e erro.
- Considere acessibilidade, foco e navegação por teclado.
- Preserve os padrões visuais e de interação existentes.
- Organize `apps/web/src` em `app`, `pages`, `features` e `shared`, criando
  diretórios somente quando houver uma responsabilidade concreta.
- Mantenha `main.tsx` restrito à montagem da aplicação e `app` à composição
  global, providers, roteamento e layouts.
- Páginas podem compor `features` e recursos de `shared`, mas não devem conter
  acesso HTTP nem regras específicas de uma capacidade.
- Mantenha queries, mutations, formulários, validações e componentes específicos
  dentro da `feature` proprietária.
- `shared` deve conter somente infraestrutura e recursos genéricos, sem
  conhecimento das capacidades de negócio.
- Respeite a direção `app` → `pages` → `features` → `shared`. Uma camada
  inferior não pode importar uma camada superior.
- Não importe caminhos internos de outra `feature`; colaboração exige uma API
  pública explícita no `index.ts` da `feature` consumida.
- Mantenha estado remoto no TanStack Query e estado estritamente local próximo
  do componente que o utiliza.
- Valide respostas externas em runtime com os schemas públicos de
  `packages/contracts`; tipos TypeScript não substituem essa validação.
- Execute o verificador arquitetural do web ao criar ou mover camadas e
  `features`.

## Banco de dados

- Toda alteração persistente de esquema deve possuir uma migração revisável.
- Gere migrações pelo comando oficial e revise o SQL antes de aplicá-lo.
- Não redefina, remova volumes nem apague dados sem autorização explícita.
