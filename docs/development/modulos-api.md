# Criação e validação de módulos da API

## Finalidade

Módulos da API não devem ser criados manualmente. O gerador oficial materializa
a estrutura definida pela ADR-0001, e o validador impede que mudanças fora da
convenção avancem pelo lint, pelo `pre-commit` ou pela CI.

## Criar um módulo

Execute na raiz do repositório:

```bash
pnpm module:create work-shifts
```

O nome deve usar `kebab-case`, começar por letra minúscula e conter somente
letras minúsculas, números e hífens. O comando recusa nomes inválidos e não
sobrescreve um módulo existente.

O exemplo cria:

```text
apps/api/src/modules/work-shifts/
├── application/
│   ├── commands/
│   │   └── .gitkeep
│   └── results/
│       └── .gitkeep
├── domain/
│   ├── entities/
│   │   └── .gitkeep
│   ├── use-cases/
│   │   └── .gitkeep
│   └── value-objects/
│       └── .gitkeep
├── presentation/
│   ├── http/
│   │   ├── dto/
│   │   │   └── .gitkeep
│   │   └── mappers/
│   │       └── .gitkeep
│   └── mcp/
│       ├── dto/
│       │   └── .gitkeep
│       └── mappers/
│           └── .gitkeep
├── repository/
│   └── mappers/
│       └── .gitkeep
└── work-shifts.module.ts
```

Remova o `.gitkeep` de uma pasta quando adicionar seu primeiro arquivo real.
Registre o novo módulo na raiz de composição apropriada. Ferramentas MCP devem
ser exportadas pelo módulo e registradas no agregador compartilhado em
`src/infrastructure/mcp`.

## Responsabilidades

- `application`: services, casos de uso de orquestração e coordenação de domínio
  e persistência;
- `application/commands`: intenções imutáveis e independentes de transporte;
- `application/results`: resultados da aplicação independentes de protocolo;
- `application/use-cases`: operações públicas que orquestram persistência,
  serviços técnicos ou transações e expõem um método `execute`;
- `domain`: objetos de domínio e use cases independentes de framework;
- `domain/entities`: entidades com identidade do domínio;
- `domain/use-cases`: regras de negócio executáveis e independentes de
  framework, transporte e persistência;
- `domain/value-objects`: valores do domínio sem identidade própria;
- `presentation/http`: controllers e mapeamento do transporte HTTP;
- `presentation/mcp`: ferramentas e handlers MCP do módulo;
- `presentation/<protocolo>/dto`: entradas e saídas do protocolo;
- `presentation/<protocolo>/mappers`: conversão entre DTOs, Commands e Results;
- `repository`: contratos e implementações de acesso a dados;
- `repository/mappers`: conversão entre persistência e domínio;
- `<modulo>.module.ts`: composição NestJS e exportações públicas do módulo.

Infraestrutura utilizada por mais de um módulo permanece em
`apps/api/src/infrastructure`.

## Validar a arquitetura

Execute na raiz:

```bash
pnpm architecture:check
```

O comando é executado também por `pnpm lint`, pelo hook de `pre-commit` e pela
CI. Uma violação encerra o processo com código diferente de zero.

### Guard rails de artefatos

O validador reconhece artefatos tanto pelo sufixo do arquivo quanto pelo nome de
classes, interfaces e tipos declarados. Um artefato reconhecido fora de seu
diretório interrompe a validação. Artefatos modulares também não podem ser
criados fora de `src/modules`; somente o controller agregador e o contrato
técnico do MCP possuem exceções explícitas em `src/infrastructure/mcp`.

| Artefato               | Diretório permitido         | Arquivo                                   |
| ---------------------- | --------------------------- | ----------------------------------------- |
| Command                | `application/commands`      | `*.command.ts`                            |
| Result                 | `application/results`       | `*.result.ts`                             |
| Service                | `application`               | `*.service.ts`                            |
| Use case de aplicação  | `application/use-cases`     | `*.use-case.ts`                           |
| Use case de domínio    | `domain/use-cases`          | `*.use-case.ts`                           |
| Entity                 | `domain/entities`           | `*.entity.ts`                             |
| Value object           | `domain/value-objects`      | `*.value-object.ts`                       |
| DTO HTTP               | `presentation/http/dto`     | `*.request.dto.ts` ou `*.response.dto.ts` |
| Mapper HTTP            | `presentation/http/mappers` | `*.mapper.ts`                             |
| Controller HTTP        | `presentation/http`         | `*.controller.ts`                         |
| Guard HTTP             | `presentation/http`         | `*.guard.ts`                              |
| Metadados HTTP         | `presentation/http`         | `*.metadata.ts`                           |
| Cookies HTTP           | `presentation/http`         | `*.cookies.ts`                            |
| Pipe HTTP              | `presentation/http`         | `*.pipe.ts`                               |
| DTO MCP                | `presentation/mcp/dto`      | `*.request.dto.ts` ou `*.response.dto.ts` |
| Mapper MCP             | `presentation/mcp/mappers`  | `*.mapper.ts`                             |
| Ferramenta MCP         | `presentation/mcp`          | `*-mcp.tool.ts`                           |
| Mapper de persistência | `repository/mappers`        | `*.mapper.ts`                             |
| Repository             | `repository`                | `*.repository.ts`                         |

Os diretórios especializados existem no módulo gerado, mas seus artefatos só
devem ser criados quando houver responsabilidade concreta. Remova o `.gitkeep`
ao adicionar o primeiro arquivo. DTOs são específicos do protocolo; Commands e
Results são reutilizados por HTTP e MCP.

O validador verifica:

- nome de módulo em `kebab-case`;
- presença das quatro áreas e de `presentation/http` e `presentation/mcp`;
- presença e nome da classe `<modulo>.module.ts`;
- ausência de `infrastructure` dentro de um módulo;
- ausência de código nas antigas camadas globais;
- ausência de `.gitkeep` ao lado de arquivos reais;
- isolamento do `domain` de NestJS, infraestrutura e persistência;
- direção dos imports entre `presentation`, `application`, `domain` e
  `repository`;
- exceção controlada para o contrato MCP compartilhado;
- bloqueio de imports por caminhos internos de outro módulo.
- localização e nome em `kebab-case` dos artefatos reservados;
- localização dos casos de uso de orquestração em `application/use-cases` e dos
  casos de uso puros em `domain/use-cases`;
- localização de guards, metadados, cookies e pipes concretos na fronteira HTTP;
- ausência de subdiretórios nas pastas-folha reservadas;
- ausência de artefatos modulares fora de `src/modules`.

## Direção das dependências

```text
presentation ──→ application ──→ domain
                         └─────→ repository ──→ domain
                                            └→ infrastructure compartilhada
```

A apresentação MCP pode implementar o contrato técnico compartilhado
`infrastructure/mcp/mcp-tool`, mas não pode importar implementações do
transporte.

Colaboração entre módulos exige uma exportação pública explícita. Não importe
arquivos internos por caminhos relativos atravessando a fronteira de outro
módulo.

## Limitações conhecidas

O validador analisa imports estáticos, exports, imports dinâmicos e `require`
com especificadores literais. A análise usa expressões regulares, não um parser
AST. Novos aliases de importação, diferentes de caminhos relativos e `src/`,
devem ser incorporados ao validador antes do uso.

O validador complementa TypeScript, ESLint e testes; ele não substitui revisão
arquitetural para dependências semânticas ou decisões de domínio.
