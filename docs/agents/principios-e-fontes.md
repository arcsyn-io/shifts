# Princípios e fontes de verdade

## Idioma

- Comunique-se com o usuário sempre em português brasileiro.
- Escreva documentação, especificações, ADRs, planos e mensagens de commit em
  português.
- Preserve em inglês nomes técnicos que fazem parte do código, de APIs, de
  bibliotecas, de comandos ou de formatos estabelecidos.
- Use identificadores de código em inglês, salvo quando o módulo já possuir uma
  convenção diferente.

## Princípios de trabalho

- Inspecione o código e os documentos relacionados antes de propor ou realizar
  uma alteração.
- Faça mudanças pequenas, coesas e diretamente relacionadas à solicitação.
- Preserve alterações existentes do usuário e não modifique arquivos fora do
  escopo sem necessidade.
- Não introduza dependências, serviços ou padrões arquiteturais sem justificar a
  necessidade, as alternativas e o custo operacional.
- Nunca inclua segredos, credenciais reais, tokens ou dados sensíveis no
  repositório, em logs, exemplos, testes ou documentação.
- Não afirme que uma validação foi executada sem apresentar um resultado real.
- Quando uma informação ausente alterar materialmente o comportamento, a
  segurança, o contrato público ou a arquitetura, pare e solicite uma decisão.
- Para lacunas de baixo impacto, declare uma hipótese conservadora e suas
  consequências.

## Precedência das fontes

Considere a seguinte ordem:

1. Solicitação atual e decisões explícitas do usuário.
2. Especificação aprovada da funcionalidade em `specs/**`, quando existir.
3. Constituição do projeto em `.specify/memory/constitution.md`, quando existir.
4. ADRs aceitas em `docs/architecture/decisions/**`, quando existirem.
5. `AGENTS.md` aplicável ao diretório.
6. Documentos vigentes em `docs/**`.
7. Código e testes existentes.

O código demonstra o estado atual, mas não substitui uma especificação ou
decisão aprovada. Informe divergências entre fontes de verdade e peça uma
decisão quando a precedência não for suficiente; não escolha silenciosamente.
