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
| Código de aplicação, frontend, backend ou banco         | [Convenções de implementação](docs/development/implementacao.md)      |
| Testes, build, lint, typecheck ou definição de pronto   | [Verificações](docs/development/verificacoes.md)                      |
| Commit, branch, histórico, push ou pull request         | [Git e commits](docs/development/git-e-commits.md)                    |

Se a tarefa abranger mais de um tema, leia a combinação mínima de documentos
necessária.

## Delegação

Use delegação somente quando ela reduzir risco ou permitir trabalho realmente
independente. Não delegue apenas pelo fato de a tarefa pertencer a uma área
especializada e não repita entre agentes o mesmo levantamento, inspeção ou
validação.

### Classificação da mudança

Considere uma mudança **pequena e local** quando todos os itens abaixo forem
verdadeiros:

- o comportamento esperado e a validação estão claros;
- a alteração está restrita a uma aplicação ou pacote e não muda contratos
  compartilhados;
- não cria nem altera regra de negócio, esquema de dados, integração,
  dependência, autenticação, autorização ou tratamento de dados sensíveis;
- é fácil de reverter e não exige decisão arquitetural ou migração.

Nesse caso, o agente principal pode inspecionar, implementar e validar
diretamente, sem criar especificação nem delegar. Correções localizadas,
refatorações sem mudança de comportamento, ajustes visuais e manutenção de
testes normalmente seguem esse fluxo rápido.

Considere uma mudança **não trivial** quando qualquer item acima não for
verdadeiro ou quando houver ambiguidade material. Antes de implementá-la,
delegue o levantamento ao `requirements_architect`, definido em
`.codex/agents/requirements-architect.toml`, e siga o fluxo de especificações.

### Quando envolver agentes especializados

- Delegue ao `security_reviewer` somente mudanças que afetem autenticação,
  autorização, dados sensíveis, entradas externas não confiáveis, integrações,
  dependências, infraestrutura ou limites de confiança. Uma revisão documental
  ou alteração local sem impacto nesses limites não exige essa delegação.
- Delegue ao `qa_engineer` a definição antecipada de cenários quando critérios
  de aceite, regras de negócio ou riscos forem não triviais. Para mudanças
  pequenas, o agente principal pode executar as verificações proporcionais. Use
  o `qa_engineer` após a implementação quando for necessária validação
  independente dos critérios de aceite.
- Delegue ao `frontend_developer`, `backend_developer` ou `devops_engineer`
  somente uma implementação aprovada que tenha escopo e propriedade de arquivos
  claros. O agente principal pode executar mudanças pequenas e locais nessas
  áreas.
- Paralelize apenas subtarefas independentes, com responsabilidades e arquivos
  distintos. Quando uma etapa depender da conclusão de outra, prefira execução
  sequencial pelo menor número de agentes necessário.

Na dúvida entre os fluxos, use o fluxo rápido se a hipótese for conservadora,
local e facilmente reversível. Escale a delegação quando a incerteza puder
alterar comportamento, segurança, contrato público, dados ou arquitetura.
