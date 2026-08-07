# Contrato de UI: logo ArcSyn na tela de login

## Fonte da marca

- A imagem deve ser resolvida pelo export público
  `@arcsyn-io/presentations/logo.png`.
- A dependência deve ser direta de `@arcsyn-shift/web` e resolvida pelo
  lockfile.
- A versão inicial deve ser exatamente `0.1.0`; qualquer atualização exige nova
  revisão do asset publicado e da integridade do lockfile.
- O navegador deve receber o asset pelo próprio bundle da aplicação, sem URL
  remota, CDN, base64 copiado ou geometria local alternativa.

## Apresentação responsiva

| Viewport   | Hero    | Logo no formulário | Logo no hero      |
| ---------- | ------- | ------------------ | ----------------- |
| `< 52rem`  | oculto  | visível            | oculta com o hero |
| `>= 52rem` | visível | oculta             | visível           |

- Deve existir exatamente uma logo visível em cada linha da matriz.
- A transição em `52rem` não pode produzir duplicidade nem ausência da marca.
- O enquadramento pode remover apenas espaço transparente do canvas; pixels
  visíveis, proporção e cores da marca não podem ser alterados.

## Acessibilidade

- A instância visível deve possuir o nome acessível exato `ArcSyn`.
- A instância oculta não pode permanecer na árvore de acessibilidade.
- Não deve haver texto “ArcSyn” adicional criado apenas para simular a marca.

## Compatibilidade funcional

- A árvore semântica do formulário, seus rótulos, alertas e ordem de foco não
  devem mudar.
- Estados de loading, erro de credenciais, falha de conexão e sucesso do login
  devem permanecer independentes da logo.
- O hero, os textos, a ilustração e o breakpoint existentes não fazem parte da
  mudança.

## Evidências obrigatórias

- teste automatizado do contrato de importação e acessibilidade;
- build contendo o asset local gerado;
- instalação com lockfile congelado, scripts desabilitados e somente permissão
  `read:packages` para o registry;
- exatamente uma cópia do PNG em `dist/assets`, servida same-origin;
- inspeção em `320px`, imediatamente abaixo de `52rem`, em `52rem` e em desktop
  amplo;
- screenshot antes/depois em uma viewport móvel e uma desktop;
- inspeção da árvore de acessibilidade e da rede sem requisição externa da logo.
