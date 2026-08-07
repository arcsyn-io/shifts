# Plano de implementação: logo oficial do Design System no login

**Branch**: não criada; extensão Git do Spec Kit não habilitada | **Data**:
2026-08-06 | **Spec**: [spec.md](spec.md)

**Entrada**: especificação em `specs/002-login-logo-design-system/spec.md`.

## Resumo

Substituir a geometria e o texto mantidos localmente por um componente de imagem
da feature de autenticação que consome o export público e versionado
`@arcsyn-io/presentations/logo.png`. O Vite incorporará o PNG oficial ao bundle
web; o layout continuará alternando a única instância visível entre o formulário
e o hero no breakpoint existente de `52rem`. O componente e os estilos antigos
serão removidos, e a validação cobrirá fonte do asset, acessibilidade,
responsividade, empacotamento e regressão do login.

## Contexto técnico

**Linguagem/versão**: TypeScript 5.7.2 e JSX

**Dependências principais**: React 18.3.1, Vite 6.0.5, `@arcsyn-io/react@0.1.0`
e novo consumo direto de `@arcsyn-io/presentations@0.1.0`

**Persistência**: não se aplica

**Testes**: Vitest 2.1.8, verificador arquitetural do web, build Vite e
validação manual no navegador

**Plataforma alvo**: navegadores web suportados pela aplicação React, com layout
mobile first a partir de `320px`

**Tipo de projeto**: aplicação web em monorepo pnpm/Turborepo

**Objetivos de desempenho**: nenhuma requisição externa em runtime para mostrar
a marca; somente o asset necessário deve entrar no bundle da aplicação

**Restrições**: preservar fidelidade e proporção do PNG oficial, tema dark,
breakpoint de `52rem`, uma única marca visível e acessível por viewport e todos
os comportamentos existentes de autenticação

**Escala/escopo**: uma tela, dois pontos de renderização responsivos, um novo
componente visual local e uma dependência direta já publicada pelo DS

## Verificação dos princípios do projeto

_Gate: deve passar antes da pesquisa e foi reavaliado após o design._

- **Fonte de verdade — aprovado**: a marca vem de um subpath público do pacote
  oficial do Design System; não será copiada nem redesenhada.
- **Escopo coeso — aprovado**: a mudança permanece em `apps/web`, além do
  manifest e lockfile necessários; API, contratos compartilhados, dados e
  infraestrutura não são afetados.
- **Arquitetura frontend — aprovado**: o recurso permanece dentro da feature
  `auth`, proprietária da tela; não cria dependência entre features nem altera a
  direção das camadas.
- **Mobile first e acessibilidade — aprovado**: o estado móvel continua sendo a
  base, o breakpoint atual é preservado e a árvore de acessibilidade expõe uma
  única marca “ArcSyn”.
- **Dependências explícitas — aprovado**: o pacote é uma dependência direta do
  consumidor, o subpath e o tarball publicados foram verificados, e o lockfile
  registrará versão exata, origem e integridade. O pacote não possui scripts de
  lifecycle, e a instalação de CI continuará usando lockfile congelado e
  `--ignore-scripts`.
- **Segurança e privacidade — aprovado**: não há entrada externa, dado sensível,
  script remoto, CDN nem alteração de CSP; somente um PNG estático é importado.
- **Qualidade — aprovado**: testes próximos ao comportamento, lint, typecheck,
  teste, build e evidências visuais móvel/desktop fazem parte da validação.
- **Decisão arquitetural — aprovado**: não há mudança duradoura de fronteira,
  contrato público da aplicação, dados ou comunicação que justifique ADR.

### Reavaliação após o design

O desenho mantém todos os gates aprovados. O contrato visual está documentado em
`contracts/login-logo-ui.md`, não há modelo persistente e a validação end-to-end
está descrita em `quickstart.md`. Não existem violações a justificar.

## Estrutura do projeto

### Documentação desta funcionalidade

```text
specs/002-login-logo-design-system/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── login-logo-ui.md
└── checklists/
    └── requirements.md
```

### Código-fonte afetado

```text
apps/web/
├── package.json
├── src/
│   ├── features/auth/components/
│   │   ├── ArcSynBrand.tsx       # remover
│   │   ├── ArcSynLogo.tsx        # criar; sem geometria local
│   │   ├── LoginForm.tsx         # consumir ArcSynLogo
│   │   └── LoginHero.tsx         # consumir ArcSynLogo
│   └── shared/styles/global.css  # trocar seletores e dimensionar o asset
└── test/
    └── login-logo.test.ts        # contrato do asset e da apresentação

pnpm-lock.yaml                    # registrar pacote e integridade resolvidos
```

**Decisão de estrutura**: a logo é usada somente pela experiência de login e
permanece em `features/auth/components`. Não será promovida a `shared` sem um
segundo consumidor genérico. Um único `frontend_developer` será proprietário de
todos os arquivos da implementação; nenhum pacote compartilhado do Shift será
editado.

## Desenho da implementação

1. Adicionar `@arcsyn-io/presentations@0.1.0` como dependência direta de
   `@arcsyn-shift/web` pelo pnpm e revisar a entrada gerada no lockfile.
2. Criar `ArcSynLogo` como componente de imagem simples, importando somente o
   subpath `@arcsyn-io/presentations/logo.png` e expondo o nome acessível
   “ArcSyn”. O componente não deve importar a raiz JavaScript do pacote.
3. Substituir os dois usos de `ArcSynBrand` em `LoginForm` e `LoginHero`,
   preservando os contêineres semânticos e a alternância já controlada pelos
   ancestrais responsivos.
4. Trocar os estilos exclusivos de `.arcsyn-brand` por estilos da imagem e de
   seu enquadramento. O PNG possui canvas transparente maior que a área visível;
   o enquadramento pode ocultar somente transparência, seguindo o padrão usado
   pela documentação do DS, sem cortar pixels da marca nem alterar sua razão.
5. Remover `ArcSynBrand.tsx` e seletores obsoletos depois de confirmar que não
   existem referências restantes.
6. Adicionar testes que falhem se o código voltar a usar geometria local, URL
   externa ou nome acessível incorreto, e confirmar que o build emite o PNG
   oficial como asset local.
7. Validar uma instalação com lockfile congelado e scripts desabilitados,
   confirmando que CI e Vercel possuem apenas o acesso `read:packages`
   necessário e que nenhuma credencial chega ao runtime.
8. Executar o roteiro de `quickstart.md`, incluindo os quatro estados de
   viewport e evidências antes/depois em mobile e desktop.

## Rastreamento de complexidade

Não há violações dos princípios do projeto nem complexidade excepcional a
justificar.
