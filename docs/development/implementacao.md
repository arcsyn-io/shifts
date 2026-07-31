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

## Backend e worker

Use o gerador e o validador descritos em
[Criação e validação de módulos da API](modulos-api.md).

- Organize capacidades da API em `src/modules/<modulo>`.
- Cada módulo contém `application`, `presentation`, `domain` e `repository`,
  além de `<modulo>.module.ts`.
- `application` contém services e coordena domínio e persistência.
- `presentation` contém controllers HTTP e ferramentas ou handlers MCP.
- A apresentação MCP pode implementar o contrato técnico compartilhado pelo
  agregador em `infrastructure/mcp`, sem importar implementações do transporte.
- `domain` contém objetos de domínio e use cases sem dependência de NestJS,
  transporte ou persistência.
- `repository` contém contratos e implementações de acesso a dados do módulo.
- Infraestrutura usada por vários módulos permanece em `src/infrastructure`.
- A direção principal é `presentation` → `application` → `domain`/`repository`.
- Módulos não importam caminhos internos de outros módulos; colaboração exige
  uma exportação pública explícita.
- Mantenha regras de negócio fora de controllers e adaptadores de protocolo.
- Use `packages/contracts` para contratos compartilhados, `packages/database`
  para persistência, `packages/config` para configuração e
  `packages/observability` para logs e telemetria.
- Valide entradas externas e aplique autorização na fronteira apropriada.

## Frontend

- Não duplique formatos de contratos compartilhados.
- Inclua estados de carregamento, vazio e erro.
- Considere acessibilidade, foco e navegação por teclado.
- Preserve os padrões visuais e de interação existentes.

## Banco de dados

- Toda alteração persistente de esquema deve possuir uma migração revisável.
- Gere migrações pelo comando oficial e revise o SQL antes de aplicá-lo.
- Não redefina, remova volumes nem apague dados sem autorização explícita.
