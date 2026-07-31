# Instruções para agentes

Este arquivo é o índice de instruções do ArcSyn Shift. Leia somente os
documentos relacionados à tarefa atual; não carregue todas as referências por
padrão. Um `AGENTS.md` mais próximo pode complementar estas regras em seu
diretório.

## Regras essenciais

- Comunique-se com o usuário e escreva documentação e commits em português
  brasileiro. Preserve em inglês identificadores de código e nomes técnicos.
- Inspecione o contexto relacionado antes de alterar arquivos.
- Faça mudanças pequenas e coesas, preserve o trabalho do usuário e não inclua
  alterações fora do escopo.
- Nunca registre segredos, credenciais reais, tokens ou dados sensíveis.
- Não invente regras de negócio nem esconda divergências entre documentação,
  testes e código.
- Só crie commits, altere histórico, faça `push` ou abra pull requests mediante
  solicitação explícita.

## Referências por tipo de tarefa

| Quando a tarefa envolver                                | Leia antes de agir                                                    |
| ------------------------------------------------------- | --------------------------------------------------------------------- |
| Planejamento, conflitos entre fontes ou regras gerais   | [Princípios e fontes de verdade](docs/agents/principios-e-fontes.md)  |
| Fronteiras, pacotes, contratos, dados ou integrações    | [Visão geral da arquitetura](docs/architecture/visao-geral.md)        |
| Funcionalidade não trivial, especificação, plano ou ADR | [Fluxo de especificações e ADRs](docs/specifications/fluxo-e-adrs.md) |
| Código de aplicação, frontend, backend, worker ou banco | [Convenções de implementação](docs/development/implementacao.md)      |
| Testes, build, lint, typecheck ou definição de pronto   | [Verificações](docs/development/verificacoes.md)                      |
| Commit, branch, histórico, push ou pull request         | [Git e commits](docs/development/git-e-commits.md)                    |

Se a tarefa abranger mais de um tema, leia a combinação mínima de documentos
necessária.

## Delegação

Antes de implementar uma funcionalidade não trivial, delegue o levantamento ao
agente `requirements_architect` definido em
`.codex/agents/requirements-architect.toml` e siga o fluxo de especificações.

Delegue ao `security_reviewer` mudanças que envolvam autenticação, autorização,
dados sensíveis, entradas externas, integrações, dependências, infraestrutura ou
limites de confiança.

Delegue ao `qa_engineer` a criação de cenários para funcionalidades não triviais
e a validação dos critérios de aceite após a implementação.

Delegue ao `frontend_developer` tarefas aprovadas e restritas a `apps/web` após
a definição dos contratos compartilhados.

Delegue ao `backend_developer` tarefas aprovadas de API, worker e persistência,
com propriedade explícita para qualquer pacote compartilhado afetado.

Delegue ao `devops_engineer` tarefas aprovadas de CI/CD, contêineres,
infraestrutura, implantação e confiabilidade operacional.
