# Git e commits

## Operações

- Só crie commits quando o usuário solicitar explicitamente.
- Não altere commits existentes, faça `push` ou crie pull request sem
  solicitação explícita.
- Preserve alterações do usuário e não inclua arquivos não relacionados.
- Prefira separar alterações com intenções diferentes em commits distintos.

## Conventional Commits

Use
[Conventional Commits 1.0.0-beta.4](https://www.conventionalcommits.org/pt-br/v1.0.0-beta.4/):

```text
<tipo>[escopo opcional]: <descrição>

[corpo opcional]

[rodapé opcional]
```

- Use `feat` para uma nova funcionalidade e `fix` para uma correção.
- Use outros tipos coerentes, como `docs`, `test`, `refactor`, `perf`, `style`,
  `build`, `ci` e `chore`.
- Escreva a descrição em português, de forma curta e no imperativo.
- Para mudança incompatível, adicione `!` ao prefixo e um rodapé iniciado por
  `BREAKING CHANGE:`.

Exemplos:

```text
feat(api): adiciona consulta de turnos
fix(database): corrige conexão das migrações
docs(architecture): registra decisão sobre eventos
test(api): adiciona cenários de autorização
chore: configura agente de requisitos
```

## Pull requests abertas pela IA

Use o template padrão em
[`/.github/pull_request_template.md`](../../.github/pull_request_template.md). A
IA deve preencher todas as seções com informações verificadas e remover textos
de orientação que tenham escapado dos comentários HTML.

### Antes de abrir

1. Confirme que existe solicitação explícita para criar a pull request.
2. Trabalhe em uma branch dedicada. Para branches criadas pelo Codex, use
   `codex/<descricao-em-kebab-case>`.
3. Confirme o escopo dos commits e preserve alterações não relacionadas.
4. Obtenha autorização explícita antes de criar commits ou publicar a branch,
   caso essas operações ainda sejam necessárias.
5. Execute as verificações proporcionais ao escopo conforme
   [Verificações](verificacoes.md).
6. Confirme que a branch remota contém exatamente os commits que participarão da
   PR.

### Título

Use o formato de Conventional Commits também no título:

```text
<tipo>[escopo opcional]: <descrição>
```

O título deve resumir o resultado da PR em português e no imperativo. Isso
permite reutilizá-lo como mensagem do commit final quando o repositório adotar
`squash merge`.

### Descrição

- Explique o que mudou e por que a mudança é necessária.
- Referencie somente issues, especificações e ADRs existentes.
- Use `Closes #<numero>` apenas quando a PR realmente encerrar a issue.
- Descreva um fluxo objetivo para validação manual ou explique por que ele não
  se aplica.
- Marque somente comandos e itens de checklist efetivamente verificados.
- Informe verificações não executadas, falhas conhecidas e riscos residuais.
- Não copie logs extensos para a descrição; apresente somente a evidência
  necessária para a revisão.
- Não exponha segredos, tokens, credenciais, dados pessoais ou informações
  internas sensíveis.

### Evidências e screenshots

- Para alterações visuais, capture antes e depois quando ambos estiverem
  disponíveis e informe as dimensões das viewports usadas.
- Para alterações responsivas, inclua pelo menos uma evidência desktop e uma
  mobile.
- Para API ou MCP, prefira exemplos reduzidos de request e response.
- Para infraestrutura ou operação, apresente logs ou resultados relevantes sem
  dados sensíveis.
- Anexe screenshots à PR; não adicione imagens ao repositório somente para
  documentar a revisão.
- Se a ferramenta usada para abrir a PR não puder anexar uma evidência
  necessária, declare a limitação e mantenha a PR como draft.
- Para mudanças sem impacto visual, registre `Não se aplica` com uma explicação
  curta.

### Draft ou pronta para revisão

Abra como draft quando existir qualquer uma destas condições:

- verificação obrigatória não executada ou com falha;
- evidência necessária ainda não anexada;
- critério de aceite, decisão ou risco relevante em aberto;
- implementação sabidamente incompleta;
- solicitação explícita do usuário.

Marque como pronta para revisão somente quando o escopo estiver completo, as
verificações aplicáveis tiverem sido aprovadas e os riscos residuais estiverem
documentados.

### Depois de abrir

Apresente ao usuário:

- link da PR;
- branch de origem e branch de destino;
- estado draft ou pronta para revisão;
- resumo das verificações executadas;
- pendências, limitações ou riscos residuais.

Não atribua reviewers, labels, milestones nem projetos sem solicitação explícita
ou regra previamente registrada no repositório.
