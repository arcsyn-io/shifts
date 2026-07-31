# ADR-0001: Organização modular da API

- **Status:** Aceita
- **Data:** 2026-07-31
- **Responsáveis:** equipe de desenvolvimento do ArcSyn Shift
- **Funcionalidade relacionada:** reorganização estrutural de `apps/api`

## Contexto

A API está organizada atualmente por camadas globais: `application`,
`presentation` e `infrastructure`. Essa organização distribui arquivos de uma
mesma capacidade entre diretórios distantes e tende a aumentar o acoplamento
entre funcionalidades conforme novos domínios forem adicionados.

O módulo existente de saúde possui um serviço de aplicação, um controller HTTP e
integração com o adaptador MCP. A infraestrutura de banco já representa uma
capacidade compartilhada da aplicação.

## Forças de decisão

- Manter arquivos relacionados a uma capacidade próximos entre si.
- Preservar os mesmos serviços de aplicação para HTTP e MCP.
- Isolar regras e objetos de domínio de NestJS e dos protocolos de transporte.
- Compartilhar conexões, configuração e recursos técnicos entre módulos.
- Permitir a evolução independente dos módulos sem duplicar infraestrutura.
- Evitar abstrações e diretórios sem responsabilidade real.

## Alternativas consideradas

### Camadas globais

Manter `application`, `presentation` e `infrastructure` diretamente sob `src`. É
simples no estado atual, mas espalha cada funcionalidade por toda a árvore e
reduz a coesão à medida que a API cresce.

### Módulos por capacidade com infraestrutura compartilhada

Agrupar cada capacidade em `src/modules/<modulo>` e manter em cada módulo as
camadas `application`, `presentation`, `domain` e `repository`. Manter
`src/infrastructure` fora de `modules` para recursos técnicos compartilhados.
Essa opção melhora a coesão e explicita fronteiras, mas exige regras claras de
dependência e composição para transportes compartilhados, especialmente MCP.

### Módulos totalmente autônomos

Colocar também banco, configuração e adaptadores técnicos em cada módulo. A
autonomia seria maior, porém haveria duplicação de conexões, configuração e
composição operacional sem benefício demonstrado para a aplicação atual.

## Decisão proposta

Adotar módulos organizados por capacidade em `apps/api/src/modules`. Cada módulo
deverá conter:

- `application`: serviços de aplicação e orquestração;
- `presentation/http`: controllers e mapeamento do contrato HTTP;
- `presentation/mcp`: ferramentas, handlers e adaptadores MCP do módulo;
- `domain`: objetos de domínio e casos de uso;
- `repository`: implementações de acesso a dados e persistência do módulo;
- `<modulo>.module.ts`: composição NestJS da capacidade.

`apps/api/src/infrastructure` permanecerá fora de `modules` e conterá recursos
compartilhados, como conexão com banco, configuração de transportes e outras
integrações técnicas usadas por mais de um módulo.

As dependências seguirão estas direções:

1. `presentation` depende de `application` e pode implementar contratos técnicos
   de transporte exportados pela infraestrutura compartilhada;
2. `application` coordena `domain` e `repository`;
3. `repository` pode depender de objetos do `domain`, da infraestrutura
   compartilhada e das exportações públicas de `packages/database`;
4. `domain` não depende de NestJS, controllers, infraestrutura ou detalhes de
   persistência;
5. um módulo não importa caminhos internos de outro módulo; colaboração entre
   módulos exige uma interface pública explícita;
6. `app.module.ts` atua somente como raiz de composição.

As quatro áreas devem existir fisicamente em cada módulo. Quando uma área ainda
não possuir responsabilidade concreta, ela pode conter somente um marcador
`.gitkeep`, que deverá ser removido assim que houver uma implementação real.

O transporte MCP manterá um único endpoint agregador. Cada módulo poderá
fornecer suas ferramentas ou handlers, enquanto a composição do servidor MCP
ficará em `src/infrastructure/mcp`. Controllers de rota duplicada em cada módulo
não são permitidos.

Os testes permanecerão inicialmente em `apps/api/test`. Contratos e
implementações de persistência pertencem à camada `repository` do módulo; ela
pode consumir a infraestrutura compartilhada e `packages/database`.

## Consequências positivas

- Maior coesão entre código de uma mesma capacidade.
- Fronteiras funcionais mais visíveis.
- Menor tendência de crescimento de camadas globais compartilhadas.
- Reuso explícito da infraestrutura comum.
- Evolução e testes podem ser organizados por módulo.

## Consequências negativas

- Mais diretórios e arquivos de composição NestJS.
- Necessidade de disciplinar importações entre camadas e módulos.
- O transporte MCP precisa de um mecanismo agregador para ferramentas de
  diferentes módulos.
- A separação entre serviços de aplicação e casos de uso no domínio pode gerar
  duplicação se suas responsabilidades não forem definidas com precisão.

## Riscos

- Transformar a estrutura em uma hierarquia cerimonial de diretórios vazios.
- Criar dependências circulares entre módulos.
- Acoplar objetos de domínio a contratos HTTP ou MCP.
- Tratar `repository` como infraestrutura global e perder a propriedade dos
  dados por módulo.
- Registrar vários controllers para a mesma rota MCP.
- Alterar comportamento durante uma migração que deveria ser estrutural.

## Impactos

### Frontend

Nenhum impacto esperado nos contratos públicos ou nas rotas existentes.

### Backend

Todos os arquivos atuais de saúde e MCP serão realocados ou recompostos. Os
imports e metadados dos módulos NestJS deverão ser atualizados.

### Dados

O esquema e as migrações continuam em `packages/database`. Repositórios de
módulo consomem a conexão compartilhada e não assumem a propriedade da evolução
global do esquema.

### Infraestrutura

`DatabaseModule` permanece em `src/infrastructure/database`. A infraestrutura
compartilhada não deve conter regras de negócio específicas de módulos.

### Segurança

Validação e autenticação de transporte permanecem nas fronteiras de
apresentação; autorização de negócio deve ser aplicada antes do acesso ao
repositório. A reorganização não deve ampliar exportações internas.

### Testes

Imports dos testes existentes deverão ser atualizados. Testes unitários podem
ficar próximos ao módulo ou continuar em `test`; a convenção precisa ser
definida. Devem permanecer verificações de que HTTP e MCP reutilizam a mesma
lógica e preservam seus contratos.

### Operação

Não há mudança esperada em processo, porta, rota, variáveis de ambiente ou
implantação.

## Plano de adoção ou migração

1. Criar o módulo `health` como primeiro exemplo da convenção.
2. Mover o serviço de saúde para `modules/health/application`.
3. Mover o controller HTTP para `modules/health/presentation/http`.
4. Separar a contribuição de saúde ao MCP da composição compartilhada do
   endpoint, preservando `/mcp` e `health_check`.
5. Manter `DatabaseModule` em `src/infrastructure/database`.
6. Atualizar `AppModule`, imports e testes sem alterar contratos externos.
7. Atualizar a visão arquitetural e as convenções de implementação.
8. Executar lint, typecheck, testes e build da API.

## Evidências de validação

- `GET /api/health` mantém a resposta atual.
- O endpoint `/mcp` continua listando e executando `health_check`.
- A inicialização ainda verifica a conexão com PostgreSQL.
- Não existem imports dos módulos para controllers ou adaptadores de outro
  módulo.
- O domínio não importa NestJS nem infraestrutura.
- `pnpm architecture:check` é aprovado.
- Lint, typecheck, testes e build da API são aprovados.

## Decisões complementares

- As quatro áreas existirão fisicamente em cada módulo.
- O agregador MCP ficará em `src/infrastructure/mcp`.
- Os testes permanecerão em `apps/api/test` até nova decisão.
- Interfaces e implementações de persistência ficarão em `repository`.
- Commands e Results independentes de protocolo ficarão em
  `application/commands` e `application/results`.
- DTOs e mappers de transporte ficarão sob o adaptador HTTP ou MCP que os
  utiliza; mappers de persistência ficarão em `repository/mappers`.
- Use cases, entidades e value objects ficarão sob `domain/use-cases`,
  `domain/entities` e `domain/value-objects`.
- O validador arquitetural impedirá que artefatos com responsabilidades
  reconhecíveis sejam criados fora desses diretórios.
