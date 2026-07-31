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
test(worker): adiciona cenários de reprocessamento
chore: configura agente de requisitos
```
