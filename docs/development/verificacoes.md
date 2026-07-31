# Verificações

Use verificações proporcionais ao escopo. Para mudanças transversais, execute o
conjunto completo:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Para mudanças locais, podem ser usados filtros do pnpm, desde que todos os
pacotes afetados e seus consumidores relevantes sejam cobertos.

Para banco de dados, revise o SQL gerado e use:

```bash
pnpm db:generate
pnpm db:migrate
```

Não execute `pnpm db:reset`, remova volumes ou apague dados sem solicitação ou
autorização explícita.

## Formatação

- Use Prettier para arquivos suportados pelo projeto.
- Markdown e MDX usam largura de 80 caracteres e `proseWrap: always`.
- O hook de `pre-commit` formata arquivos Markdown e MDX preparados para commit.
- Não desfaça manualmente as quebras de linha produzidas pelo Prettier.
- Mantenha arquivos textuais em UTF-8.

## Definição de pronto

Uma alteração só está pronta quando:

- atende aos critérios de aceite aplicáveis;
- preserva as fronteiras arquiteturais ou registra a decisão de alterá-las;
- possui testes adequados ao risco e ao comportamento alterado;
- passou pelas verificações pertinentes;
- atualiza contratos, migrações, documentação e ADRs afetados;
- não contém segredos nem alterações não relacionadas;
- apresenta ao usuário um resumo objetivo e as validações executadas.

Não afirme que uma validação foi executada sem um resultado real. Se uma
verificação não puder ser executada, informe o motivo e o risco residual.
