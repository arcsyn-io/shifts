# Modelo de dados: logo oficial do Design System no login

## Persistência

A funcionalidade não cria, lê, altera nem remove dados persistentes. Não há
entidades de domínio, tabelas, contratos de API, eventos ou migrações.

## Estado de apresentação

O comportamento pode ser descrito por um estado derivado exclusivamente da
viewport; ele não deve ser persistido nem mantido em estado React.

| Estado   | Condição                    | Posição visível         | Posição oculta      | Nome acessível |
| -------- | --------------------------- | ----------------------- | ------------------- | -------------- |
| Estreito | largura menor que `52rem`   | cabeçalho do formulário | hero completo       | `ArcSyn`       |
| Amplo    | largura a partir de `52rem` | topo do hero            | marca do formulário | `ArcSyn`       |

## Regras e transições

- A transição entre estados ocorre quando a viewport cruza `52rem` e é
  responsabilidade do CSS existente.
- No ponto exato de `52rem`, o estado amplo prevalece.
- Em cada estado existe uma única imagem visível e uma única marca exposta à
  árvore de acessibilidade.
- A URL final do asset é gerada no build; não é dado de usuário nem configuração
  de runtime.
- Nenhum estado de autenticação altera a fonte, o nome ou a posição responsiva
  da logo.
