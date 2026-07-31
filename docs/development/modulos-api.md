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
│   └── .gitkeep
├── domain/
│   └── .gitkeep
├── presentation/
│   ├── http/
│   │   └── .gitkeep
│   └── mcp/
│       └── .gitkeep
├── repository/
│   └── .gitkeep
└── work-shifts.module.ts
```

Remova o `.gitkeep` de uma pasta quando adicionar seu primeiro arquivo real.
Registre o novo módulo na raiz de composição apropriada. Ferramentas MCP devem
ser exportadas pelo módulo e registradas no agregador compartilhado em
`src/infrastructure/mcp`.

## Responsabilidades

- `application`: services e coordenação de domínio e persistência;
- `domain`: objetos de domínio e use cases independentes de framework;
- `presentation/http`: controllers e mapeamento do transporte HTTP;
- `presentation/mcp`: ferramentas e handlers MCP do módulo;
- `repository`: contratos e implementações de acesso a dados;
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
