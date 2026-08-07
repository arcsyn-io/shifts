# Guia de validação: logo oficial do Design System no login

## Pré-requisitos

- Node.js e pnpm nas versões aceitas pelo repositório;
- acesso já configurado ao GitHub Packages para os pacotes `@arcsyn-io`;
- implementação concluída conforme [plan.md](plan.md);
- navegador com inspeção de rede, layout responsivo e árvore de acessibilidade.

## Instalação e verificações automatizadas

Na raiz do repositório:

```bash
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @arcsyn-shift/web lint
pnpm --filter @arcsyn-shift/web typecheck
pnpm --filter @arcsyn-shift/web test
pnpm --filter @arcsyn-shift/web build
```

Resultados esperados:

- todos os comandos terminam com código zero;
- o lockfile resolve `@arcsyn-io/presentations@0.1.0` pelo GitHub Packages com
  integridade registrada, sem executar scripts de dependência;
- o build resolve `@arcsyn-io/presentations/logo.png` e emite exatamente um PNG
  local em `dist/assets`, com tamanho aproximado de `19.908 bytes` e bytes
  compatíveis com o SHA-256
  `fb262854e6de8ba2b368dfc288dddfae707538738989669744ab06f7faacbb92`;
- não existem referências a `ArcSynBrand`, geometria SVG local ou URL externa
  para a logo no código de produção.

## Execução local

```bash
pnpm --filter @arcsyn-shift/web dev --host 127.0.0.1
```

Abrir `/login` na URL informada pelo Vite. A infraestrutura de autenticação não
é necessária para inspecionar a apresentação inicial; ela é necessária somente
para repetir os fluxos funcionais de login.

## Matriz responsiva

Validar pelo menos estas viewports:

| Viewport     | Resultado esperado                                         |
| ------------ | ---------------------------------------------------------- |
| `320 × 800`  | logo no formulário, hero oculto, sem overflow horizontal   |
| `831 × 900`  | estado estreito preservado imediatamente abaixo de `52rem` |
| `832 × 900`  | logo no hero, marca do formulário oculta                   |
| `1440 × 900` | logo no hero, proporção e composição desktop preservadas   |

Em todas as viewports:

1. comparar a imagem com o asset oficial do pacote;
2. confirmar ausência de corte de pixels visíveis, distorção ou recoloração;
3. confirmar exatamente uma logo visível;
4. inspecionar a árvore de acessibilidade e localizar exatamente um nome
   `ArcSyn` para a marca;
5. inspecionar a rede e confirmar que nenhuma requisição externa é necessária
   para carregar a logo e que sua resposta é same-origin.

Também confirmar que tokens de desenvolvimento e build possuem somente o acesso
`read:packages` necessário e não são incluídos no bundle ou nas requisições do
navegador.

## Regressão funcional

Com a API e o ambiente de autenticação disponíveis, repetir:

- envio válido e navegação pós-login;
- credenciais inválidas;
- falha de conexão;
- estado de carregamento;
- navegação por teclado e foco nos erros.

Os resultados devem permanecer iguais aos anteriores à mudança.

## Evidências

- registrar antes e depois em `320 × 800` e `1440 × 900`;
- anotar os comandos executados e seus resultados reais;
- não adicionar screenshots ao repositório apenas para revisão; anexá-las à PR
  quando a implementação for publicada.
