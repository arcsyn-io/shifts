# Fluxo de especificações e ADRs

## Quando realizar levantamento

Antes de implementar uma funcionalidade não trivial, delegue o levantamento ao
agente `requirements_architect`, definido em
`.codex/agents/requirements-architect.toml`.

Considere não trivial uma mudança que:

- introduza ou altere regra de negócio;
- afete mais de uma aplicação ou pacote;
- modifique contrato, esquema de dados ou integração;
- altere autorização, dados sensíveis ou limites de confiança;
- exija decisão arquitetural ou migração.

Mudanças pequenas e locais podem seguir diretamente, desde que comportamento,
riscos e validação estejam claros.

## Responsabilidades do agente principal

1. Fornecer ao arquiteto o objetivo e o contexto disponíveis.
2. Aguardar requisitos, critérios de aceite, impactos e questões em aberto.
3. Resolver com o usuário as questões que alterem materialmente a solução.
4. Definir um único proprietário para arquivos compartilhados.
5. Iniciar a implementação somente quando o plano estiver suficientemente claro.

Quando as skills do GitHub Spec Kit estiverem instaladas, use os fluxos
`speckit-specify`, `speckit-clarify`, `speckit-plan`, `speckit-tasks` e
`speckit-analyze` conforme a etapa. Mantenha a especificação focada no que e no
porquê; detalhes técnicos pertencem ao plano.

## ADRs

- Registre ADRs em `docs/architecture/decisions/`.
- Crie uma ADR para decisões duradouras, transversais ou difíceis de reverter,
  não para detalhes locais ou triviais.
- Toda ADR nova começa com status `Proposta`.
- Somente o usuário ou o agente principal, mediante aprovação explícita, pode
  alterar o status para `Aceita`.
- Preserve o histórico. Uma ADR substituída deve apontar para a decisão
  sucessora em vez de ser apagada ou reescrita silenciosamente.
- O `requirements_architect` redige propostas de ADR dentro dos limites
  definidos em seu arquivo de agente.
