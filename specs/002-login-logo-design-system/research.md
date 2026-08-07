# Pesquisa técnica: logo oficial do Design System no login

## Decisão 1 — Fonte oficial e contrato de distribuição

**Decisão**: consumir diretamente `@arcsyn-io/presentations/logo.png`, publicado
por `@arcsyn-io/presentations@0.1.0` no GitHub Packages, com versão exata no
manifest do web.

**Justificativa**:

- o `package.json` publicado declara explicitamente o subpath
  `./logo.png -> ./assets/arcsyn-logo.png`;
- o tarball publicado contém esse arquivo e seu hash SHA-256
  `fb262854e6de8ba2b368dfc288dddfae707538738989669744ab06f7faacbb92` corresponde
  ao asset do repositório do Design System;
- a documentação do pacote identifica esse subpath como a marca oficial;
- o Vite consegue importar o PNG como URL de asset por meio dos tipos
  `vite/client` já configurados no web;
- o consumo do subpath evita importar o módulo JavaScript de apresentações no
  runtime da aplicação;
- o pacote publicado não possui scripts de lifecycle; sua instalação completa
  ocupa aproximadamente `496 KiB`, enquanto o PNG acrescenta aproximadamente
  `20 KiB` ao bundle.

**Alternativas consideradas**:

- **Aguardar um export em `@arcsyn-io/react` ou em pacote dedicado de assets**:
  teria melhor afinidade semântica, mas o contrato ainda não existe e exigiria
  mudança e release upstream antes de atender a solicitação atual.
- **Consumir `apps/docs/public/arcsyn-logo.svg`**: rejeitado porque é um arquivo
  interno de uma aplicação do DS, não um export público versionado.
- **Copiar o PNG para `apps/web`**: rejeitado porque duplicaria a fonte de
  verdade e permitiria drift da marca.
- **Manter ou redesenhar o SVG local**: rejeitado porque contradiz diretamente o
  objetivo da funcionalidade.

## Decisão 2 — Integração com o bundle web

**Decisão**: declarar o pacote como dependência direta de `apps/web` e importar
somente o subpath PNG. O lockfile deve resolver a versão publicada e preservar a
integridade do tarball.

**Justificativa**:

- dependências usadas diretamente por uma aplicação devem estar declaradas no
  manifest dessa aplicação;
- o import estático faz o Vite copiar, hashear e referenciar o asset no bundle,
  eliminando dependência de CDN ou host externo em runtime;
- a autenticação existente do GitHub Packages já é necessária para
  `@arcsyn-io/react`, portanto não surge um novo registry operacional;
- a versão exata `0.1.0` evita que uma futura regeneração do lockfile aceite
  automaticamente outro patch `0.1.x` para um asset sensível de marca;
- a CI existente instala com `--frozen-lockfile --ignore-scripts`, reduzindo
  drift e superfície de scripts de dependência.

**Alternativas consideradas**:

- **URL externa/CDN**: rejeitada por disponibilidade, CSP, privacidade e risco
  de troca não versionada do conteúdo.
- **Data URL ou base64 no código**: rejeitada porque duplica o asset, piora a
  revisão e perde o contrato explícito com o DS.
- **Importar a raiz de `@arcsyn-io/presentations`**: rejeitada porque
  adicionaria código sem uso ao grafo e esconderia a dependência real do asset.

**Riscos residuais e mitigações**:

- confirmar que o pacote concede `read:packages` ao repositório consumidor e ao
  token de build da Vercel; falha de permissão deve interromper o build, sem
  fallback remoto;
- revisar versão, URL do tarball e integridade sempre que o pacote for
  atualizado;
- o manifesto publicado não declara licença; registrar como verificação de
  compliance do pacote interno, sem impacto técnico no runtime desta mudança;
- a integridade do lockfile protege os bytes baixados, mas não substitui a
  governança de publicação do Design System.

## Decisão 3 — Componente e acessibilidade

**Decisão**: substituir `ArcSynBrand` por um componente local `ArcSynLogo` que
renderiza somente a imagem oficial com nome acessível “ArcSyn”. As duas posições
responsivas podem permanecer no DOM porque seus ancestrais já alternam
`display: none`; em cada viewport somente uma instância ficará visível e exposta
à árvore de acessibilidade.

**Justificativa**:

- centraliza fonte, texto alternativo e classe da imagem sem recriar a marca;
- preserva a composição atual de `LoginForm` e `LoginHero`;
- elementos sob `display: none` não são apresentados na árvore de
  acessibilidade, evitando anúncio duplicado;
- o PNG possui canvas `574 × 315` com conteúdo alfa no retângulo aproximado
  `(0, 93)–(490, 233)`, então o enquadramento precisa considerar transparência
  sem distorcer ou cortar pixels visíveis.

**Alternativas consideradas**:

- **Duplicar `<img>` e imports nos dois consumidores**: funcional, mas repete o
  contrato de acessibilidade e facilita divergência futura.
- **Preservar o nome `ArcSynBrand` e trocar apenas seu interior**: rejeitado
  porque o nome manteria a abstração anterior de marca construída localmente e
  dificultaria verificar sua remoção completa.
- **Usar imagem decorativa com `alt=""`**: rejeitado porque a spec trata a marca
  como informação de contexto no login.

## Decisão 4 — Estratégia de validação

**Decisão**: combinar teste automatizado próximo ao código, build do web e
inspeção manual responsiva e de acessibilidade no navegador.

**Justificativa**:

- testes de fonte podem garantir o subpath oficial, ausência de geometria local,
  texto alternativo e seletores esperados;
- o build prova que o import do PNG é resolvido e que o asset é empacotado;
- a inspeção de `dist/assets` deve encontrar uma única cópia do PNG com bytes e
  tamanho compatíveis com o asset verificado;
- somente uma validação renderizada confirma enquadramento, fidelidade,
  breakpoint exato, overflow e árvore de acessibilidade;
- os testes funcionais existentes cobrem autenticação e redirecionamento e devem
  continuar passando.

**Alternativas consideradas**:

- **Somente snapshot ou teste estático**: insuficiente para proporção e layout
  responsivo.
- **Adicionar nova ferramenta end-to-end**: desnecessário para uma mudança
  visual local; aumentaria dependências e manutenção sem benefício proporcional.

## Pendências de pesquisa

Nenhuma. As decisões necessárias ao plano foram resolvidas com os contratos e
artefatos publicados atualmente.
