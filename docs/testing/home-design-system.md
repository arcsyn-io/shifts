# Plano de testes — página inicial com ArcSyn Design System

## 1. Resumo de qualidade

Este plano cobre a adoção de componentes de `@arcsyn-io/react`, IBM Plex Sans
carregada pelo Design System (DS) e tema `dark` como padrão da página inicial de
`apps/web`.

A implementação final usa `PageHeader`, `Card` e `StatusIndicator` do DS,
sobrescreve o token sans com IBM Plex Sans e delimita a home com
`data-arcsyn-theme="dark"`. A avaliação é aprovada para o escopo principal, com
riscos residuais nos cenários sem evidência de execução detalhados abaixo.

## 2. Escopo e riscos considerados

### Dentro do escopo

- renderização da rota `/` com componentes React fornecidos pelo DS;
- IBM Plex Sans como fonte efetivamente computada e renderizada;
- tema `dark` aplicado por padrão, independentemente da preferência do sistema;
- preservação dos estados de carregamento, sucesso e erro do health check;
- semântica, anúncio de estado, contraste, foco e navegação por teclado;
- responsividade entre 320 px e desktop;
- impacto dos estilos globais na rota não encontrada;
- `lint`, `typecheck`, testes e build de `@arcsyn-shift/web`.

### Riscos prioritários

- P0: o token `--arcsyn-font-sans` da versão instalada do DS aponta para
  Alexandria, apesar de o pacote carregar IBM Plex Sans;
- P0: o tema claro do `:root` do DS ou regras antigas do `global.css`
  prevalecerem sobre `dark` durante ou depois do bootstrap;
- P1: uso apenas cosmético do CSS do DS, sem componentes React do pacote;
- P1: perda do anúncio acessível e dos estados do health check na recomposição;
- P1: contraste ou legibilidade insuficiente após a troca global de tema;
- P1: overflow em 320 px causado pelo layout ou pelos componentes do DS;
- P2: flash de tema claro na carga fria;
- P2: regressão visual na rota `*` devido à alteração global de cores e fonte.

## 3. Requisitos e critérios de aceite

### Requisitos

- RF-01: a página inicial deve usar componentes de `@arcsyn-io/react` para as
  regiões visuais que tiverem equivalente aprovado no DS.
- RF-02: a página deve continuar expondo o estado da API nos estados de
  carregamento, sucesso e erro.
- RNF-01: IBM Plex Sans, fornecida pelo DS, deve ser a fonte sans efetivamente
  computada e renderizada na página inicial.
- RNF-02: `dark` deve ser o tema padrão da aplicação.
- RNF-03: a mudança deve preservar acessibilidade básica, legibilidade e
  responsividade da página inicial.
- RNF-04: a aplicação deve continuar passando pelas verificações proporcionais
  do pacote web.

### Critérios observáveis

- CA-01: abrir `/` não gera erro de renderização nem erro de carregamento de
  módulo, CSS ou fonte no console e na rede.
- CA-02: a inspeção do código e da árvore renderizada comprova que os
  componentes visuais acordados são importados de `@arcsyn-io/react` e realmente
  renderizados; elementos HTML de layout não contam como substitutos do DS.
- CA-03: em `html`, `body`, título, texto e estado da API, a primeira família de
  `font-family` computada é `IBM Plex Sans`.
- CA-04: após `document.fonts.ready`,
  `document.fonts.check('16px "IBM Plex Sans"')` retorna `true`; a fonte é
  obtida dos assets transitivos do DS, sem CDN ou URL externa adicionada pelo
  app.
- CA-05: na primeira tela observável de uma carga fria, o elemento que delimita
  o tema possui `data-arcsyn-theme="dark"`, o `color-scheme` computado é `dark`
  e `--arcsyn-color-background`, `--arcsyn-color-foreground` e cores de
  superfície correspondem aos tokens `dark` do DS.
- CA-06: CA-05 permanece verdadeiro com `prefers-color-scheme: light`, sem
  preferência persistida e após recarregar a página.
- CA-07: regras locais não restauram Inter nem cores claras hardcoded sobre os
  componentes do DS; fundos, textos, bordas e estados visíveis permanecem
  legíveis no tema `dark`.
- CA-08: o health check apresenta um estado inicial de carregamento, `ok` no
  sucesso e `unavailable` no erro, mantendo `role="status"` e
  `aria-live="polite"` ou semântica equivalente do DS.
- CA-09: existe um único `h1`, o conteúdo principal está em `main`, a ordem de
  leitura é coerente, controles são alcançáveis e acionáveis por teclado e o
  foco é visível. Texto normal atinge contraste mínimo de 4,5:1 e texto grande
  3:1; componentes não textuais e foco atingem 3:1.
- CA-10: em viewports de 320 x 568, 768 x 1024 e 1440 x 900 não há overflow
  horizontal, corte ou sobreposição; com zoom de 200%, conteúdo e estado da API
  continuam disponíveis.
- CA-11: a rota não encontrada continua legível e o link de retorno permanece
  identificável, focável e acionável no tema padrão.
- CA-12: `lint`, `typecheck`, testes e build de `@arcsyn-shift/web` terminam com
  código zero após a implementação.

## 4. Lacunas e ambiguidades

- O diff estabelece o mapeamento `PageHeader` para o cabeçalho, `Card` para o
  container do health check e `StatusIndicator` para o estado da API. Não há
  referência visual para validação pixel-perfect.
- Foi decidido pelo agente principal que IBM Plex Sans deve ser efetivamente
  computada/renderizada e que o app pode sobrescrever `--arcsyn-font-sans`
  usando a fonte já carregada pelo DS. Essa decisão resolve a ambiguidade da
  tipografia na versão `0.1.0`.
- Não foi definido se haverá seleção/persistência de outro tema. Este plano
  valida apenas `dark` como estado inicial e não exige um seletor.
- Não há referência visual aprovada nem breakpoints de produto. As dimensões de
  CA-10 são uma grade mínima de regressão, não aprovação pixel-perfect.
- Não há ferramenta de testes de navegador ou ponta a ponta aprovada no
  repositório. Cenários que dependem de CSS computado e carregamento de fontes
  devem ser manuais até essa decisão.
- O projeto não registra formalmente um nível WCAG. CA-09 propõe os limiares AA
  como critério de prevenção; o agente principal deve confirmar esse alvo.

## 5. Matriz de rastreabilidade

| Requisito | Critério            | Risco coberto                                  | Cenário | Nível         | Evidência     |
| --------- | ------------------- | ---------------------------------------------- | ------- | ------------- | ------------- |
| RF-01     | CA-01, CA-02        | pacote importado sem uso real; erro de runtime | TC-001  | componente    | aprovado      |
| RNF-01    | CA-03, CA-04        | fallback para Alexandria/Inter; asset ausente  | TC-002  | ponta a ponta | aprovado      |
| RNF-02    | CA-05               | tema claro aplicado após bootstrap             | TC-003  | ponta a ponta | parcial       |
| RNF-02    | CA-05, CA-06        | preferência do sistema sobrepor o padrão       | TC-004  | ponta a ponta | não executado |
| RF-02     | CA-08               | perda de estados e anúncio do health check     | TC-005  | componente    | parcial       |
| RNF-03    | CA-07, CA-09        | contraste, foco ou semântica regressivos       | TC-006  | componente    | parcial       |
| RNF-03    | CA-10               | overflow ou conteúdo inacessível               | TC-007  | componente    | parcial       |
| RNF-03    | CA-11               | CSS global quebrar a rota não encontrada       | TC-008  | componente    | não executado |
| RNF-04    | CA-01, CA-04, CA-12 | erro de resolução, tipos ou bundle             | TC-009  | integração    | aprovado      |

## 6. Cenários priorizados

### TC-001 — Renderizar a home com componentes React do DS

- **Objetivo:** comprovar uso real de `@arcsyn-io/react`, sem erro de runtime.
- **Requisitos e critérios:** RF-01; CA-01 e CA-02.
- **Prioridade:** P1.
- **Nível:** componente.
- **Pré-condições:** mapeamento região → componente do DS aprovado; rota `/`
  disponível; CSS do DS carregado.
- **Dados:** conteúdo sintético da home e resposta de health check
  `{ status: "ok", database: "connected" }`.
- **Dado/Quando/Então:** Dado o mapeamento aprovado, quando `HomePage` for
  renderizada com seus providers, então cada região prevista deve corresponder
  ao componente importado do pacote e não deve haver erro no console.
- **Resultado esperado:** componentes acordados aparecem na árvore renderizada,
  com seu conteúdo e sem substituto local que replique o mesmo papel visual.
- **Variações e limites:** renderização sob `StrictMode`; conteúdo curto e
  longo; health check em carregamento e erro.
- **Automação:** sim, após existir harness DOM; localização sugerida:
  `apps/web/test/home-page.test.tsx`. Complementar com revisão de imports.

### TC-002 — Computar e carregar IBM Plex Sans do DS

- **Objetivo:** impedir sucesso aparente baseado apenas na declaração da fonte.
- **Requisitos e critérios:** RNF-01; CA-03 e CA-04.
- **Prioridade:** P0.
- **Nível:** ponta a ponta.
- **Pré-condições:** build servido em navegador; cache e service worker limpos.
- **Dados:** rota `/`; textos em pesos 400, 500 e 600 quando presentes.
- **Dado/Quando/Então:** Dada uma carga fria, quando `document.fonts.ready` for
  resolvido, então a família computada deve iniciar por IBM Plex Sans e
  `document.fonts.check` deve confirmar a fonte.
- **Resultado esperado:** IBM Plex Sans é renderizada nos elementos amostrados;
  assets de fonte respondem 200 e são originados do bundle do DS.
- **Variações e limites:** cache vazio e aquecido; bloqueio de rede externa;
  pesos 400, 500 e 600; sistema sem IBM Plex Sans instalada.
- **Automação:** candidata quando houver ferramenta de browser; localização
  sugerida: `apps/web/e2e/home-typography.spec.ts`. Até lá, execução manual com
  DevTools.

### TC-003 — Aplicar `dark` antes da primeira tela observável

- **Objetivo:** validar o tema padrão e evitar flash claro.
- **Requisitos e critérios:** RNF-02; CA-05 e CA-07.
- **Prioridade:** P0.
- **Nível:** ponta a ponta.
- **Pré-condições:** armazenamento, cookies e cache limpos; navegador em janela
  normal.
- **Dados:** rota `/`, preferência do sistema `dark`.
- **Dado/Quando/Então:** Dado um perfil limpo, quando `/` for carregada, então o
  tema deve ser `dark` desde a primeira tela observável e os tokens computados
  devem corresponder ao tema `dark` do DS.
- **Resultado esperado:** nenhum frame claro perceptível; `color-scheme: dark`;
  superfícies e texto usam tokens do DS sem override claro do app.
- **Variações e limites:** CPU e rede limitadas; JavaScript desabilitado apenas
  como diagnóstico do flash, sem torná-lo requisito funcional.
- **Automação:** candidata a ponta a ponta com captura inicial e CSS computado;
  localização sugerida: `apps/web/e2e/default-theme.spec.ts` após aprovação da
  ferramenta.

### TC-004 — Manter `dark` com sistema em tema claro e após reload

- **Objetivo:** comprovar que “padrão dark” não depende da preferência do SO.
- **Requisitos e critérios:** RNF-02; CA-05 e CA-06.
- **Prioridade:** P0.
- **Nível:** ponta a ponta.
- **Pré-condições:** emulação de `prefers-color-scheme: light`; armazenamento
  sem preferência da aplicação.
- **Dados:** carga direta e reload de `/`.
- **Dado/Quando/Então:** Dado o sistema em tema claro, quando a home for aberta
  e recarregada, então o tema inicial deve permanecer `dark` nas duas cargas.
- **Resultado esperado:** atributo de tema, `color-scheme` e tokens continuam
  escuros, sem alternância automática para `light`.
- **Variações e limites:** `prefers-color-scheme: no-preference`; nova aba; modo
  privado. Persistência de escolha do usuário fica fora do escopo.
- **Automação:** candidata no mesmo arquivo sugerido para TC-003.

### TC-005 — Preservar estados e anúncio do health check

- **Objetivo:** prevenir regressão funcional durante a troca dos componentes.
- **Requisitos e critérios:** RF-02; CA-08.
- **Prioridade:** P1.
- **Nível:** componente.
- **Pré-condições:** `HomePage` renderizada com `QueryClientProvider`; cache de
  query isolado por execução.
- **Dados:** promise pendente; resposta válida
  `{ status: "ok", database: "connected" }`; erro HTTP 503.
- **Dado/Quando/Então:** Dado cada resposta controlada, quando a query transitar
  entre estados, então a interface deve exibir respectivamente carregamento,
  `ok` ou `unavailable` e anunciar a mudança de forma polida.
- **Resultado esperado:** nenhum estado fica vazio ou indefinido; o container
  mantém `role="status"` e `aria-live="polite"`, ou equivalência comprovada.
- **Variações e limites:** resposta lenta; rejeição de rede; resposta fora do
  contrato; nova tentativa quando esse comportamento existir.
- **Automação:** sim; localização sugerida:
  `apps/web/test/health-status.component.test.tsx`, sem duplicar os testes de
  contrato já existentes em `fetch-health.test.ts`.

### TC-006 — Validar semântica, contraste, teclado e foco

- **Objetivo:** garantir operação e leitura acessíveis no novo tema.
- **Requisitos e critérios:** RNF-03; CA-07 e CA-09.
- **Prioridade:** P1.
- **Nível:** componente.
- **Pré-condições:** home em `dark`, health check em cada estado; extensão ou
  ferramenta de análise de acessibilidade disponível para apoio.
- **Dados:** teclado; amostras de texto normal, texto grande, bordas e foco.
- **Dado/Quando/Então:** Dada a home renderizada, quando a hierarquia, a ordem
  de tabulação e as cores forem inspecionadas, então landmarks, nome acessível,
  foco e limiares de contraste de CA-09 devem ser atendidos.
- **Resultado esperado:** um `main`, um `h1`, ordem coerente, nenhum controle
  inacessível por teclado, foco visível e contrastes mensurados aprovados.
- **Variações e limites:** carregamento, sucesso e erro; zoom 200%; conteúdo
  longo; `prefers-reduced-motion: reduce` se houver animação.
- **Automação:** parcial em `apps/web/test/home-accessibility.test.tsx` após
  aprovação do harness; contraste e foco visual exigem verificação em browser.

### TC-007 — Adaptar a home entre 320 px e desktop

- **Objetivo:** detectar overflow, corte e sobreposição do layout recomposto.
- **Requisitos e critérios:** RNF-03; CA-10.
- **Prioridade:** P1.
- **Nível:** componente.
- **Pré-condições:** home em `dark`; fonte IBM Plex Sans carregada; captura de
  viewport disponível.
- **Dados:** 320 x 568, 768 x 1024 e 1440 x 900; zoom de 200%; texto longo.
- **Dado/Quando/Então:** Dado cada viewport, quando a página for renderizada e
  rolada, então todo conteúdo deve permanecer visível sem scroll horizontal.
- **Resultado esperado:** nenhuma região se sobrepõe ou é cortada e o estado da
  API permanece legível e alcançável.
- **Variações e limites:** 320 px com texto ampliado; orientação landscape;
  estado de erro com mensagem mais longa.
- **Automação:** candidata a regressão visual/browser; localização sugerida:
  `apps/web/e2e/home-responsive.spec.ts` após definição da ferramenta.

### TC-008 — Preservar a rota não encontrada sob os estilos globais

- **Objetivo:** detectar regressão indireta causada pela fonte e pelo tema.
- **Requisitos e critérios:** RNF-03; CA-11.
- **Prioridade:** P2.
- **Nível:** componente.
- **Pré-condições:** rota inexistente disponível e tema padrão aplicado.
- **Dados:** `/rota-inexistente`.
- **Dado/Quando/Então:** Dada uma URL não mapeada, quando a rota `*` for
  renderizada, então mensagem e link de retorno devem ser legíveis e operáveis.
- **Resultado esperado:** nenhum texto invisível; link focável e acionável; ao
  ativá-lo, navegação para `/` ocorre.
- **Variações e limites:** teclado; 320 px; zoom 200%.
- **Automação:** sim, em `apps/web/test/not-found-page.test.tsx` após existir
  harness DOM; contraste deve ser complementado em browser.

### TC-009 — Verificar resolução, tipos, testes e bundle web

- **Objetivo:** comprovar compatibilidade estática e de empacotamento da
  mudança.
- **Requisitos e critérios:** RNF-04; CA-01, CA-04 e CA-12.
- **Prioridade:** P1.
- **Nível:** integração.
- **Pré-condições:** dependências instaladas conforme `pnpm-lock.yaml`; sem
  edição manual do lockfile.
- **Dados:** implementação final da home e imports públicos do DS.
- **Dado/Quando/Então:** Dada a implementação concluída, quando as verificações
  do pacote web forem executadas, então todas devem terminar com código zero e o
  build deve conter os assets de IBM Plex Sans necessários.
- **Resultado esperado:** sem erro de lint, arquitetura, tipo, teste ou Vite;
  nenhum import privado do DS; assets referenciados resolvem no preview.
- **Variações e limites:** instalação limpa conforme lockfile; base path de
  preview; inspeção de warnings que não alterem o exit code.
- **Automação:** sim, pelos scripts existentes:
  `pnpm --filter @arcsyn-shift/web lint`, `typecheck`, `test` e `build`.

## 7. Estratégia e níveis de teste

- Use teste de componente para estrutura, conteúdo, estados e semântica, sem
  repetir os testes unitários existentes de `fetchHealth`.
- Use integração para imports públicos, arquitetura e bundle do pacote web.
- Reserve ponta a ponta para fonte realmente renderizada, aplicação do tema no
  primeiro paint e comportamento sob preferência do sistema, pois testes DOM
  simulados não fornecem evidência confiável desses riscos.
- Faça revisão manual de contraste e responsividade enquanto não houver uma
  ferramenta de browser aprovada.

## 8. Dados e ambiente necessários

- respostas sintéticas de health check: pendente, HTTP 200 válido e HTTP 503;
- navegador sem IBM Plex Sans instalada no sistema, para provar uso do asset;
- perfis limpos com `prefers-color-scheme` em `light`, `dark` e sem preferência;
- cache vazio e aquecido, throttling de CPU/rede e DevTools para CSS/fontes;
- viewports de 320 x 568, 768 x 1024 e 1440 x 900;
- ambiente local sem chamadas a integrações externas reais.

## 9. Resultados e evidências de execução

### Aprovados

- TC-001 por revisão do diff: `PageHeader`, `Card` e `StatusIndicator` são
  importados de `@arcsyn-io/react` e renderizados.
- TC-002 por inspeção no browser: IBM Plex Sans foi carregada, computada e
  renderizada.
- estado final de TC-003 por inspeção no browser: tema `dark` aplicado e API
  exibida como `ok`. O primeiro frame não foi medido.
- partes de TC-005 e TC-006: browser confirmou API `ok`, único `main` e `h1`,
  `aria-live` e `aria-atomic`; revisão estática confirmou os mapeamentos de
  loading, erro e sucesso, sem execução desses estados.
- parte de TC-007: não houve overflow no viewport inspecionado.
- TC-009: conforme resultados fornecidos pelo agente principal, lint e
  arquitetura passaram, 36 testes passaram e `typecheck` e build passaram após
  construir `@arcsyn-shift/contracts`. Esses comandos não foram reexecutados
  pelo QA.

### Não executados

- TC-004 e TC-008;
- primeiro paint de TC-003;
- estados loading e erro de TC-005;
- contraste mensurado, teclado e foco de TC-006;
- demais viewports e zoom de TC-007.

## 10. Defeitos encontrados

Nenhum defeito foi confirmado no diff ou nas evidências fornecidas.

## 11. Cobertura ausente e riscos residuais

- não há testes de componente para `HomePage`, `HealthStatus` ou `NotFoundPage`;
- não há automação de browser para primeiro paint, CSS computado, fontes,
  contraste ou responsividade;
- sem referência visual, espaçamento e hierarquia só podem ser avaliados por
  critérios funcionais e de legibilidade.

## 12. Recomendações de automação

1. Priorizar TC-005 em nível de componente, cobrindo o risco funcional sem
   duplicar o contrato de `fetchHealth`.
2. Automatizar TC-001 e a parte semântica de TC-006 quando houver harness DOM.
3. Após decisão formal da ferramenta de browser, automatizar TC-002, TC-003 e
   TC-004 como smoke crítico e TC-007 como matriz curta de viewports.
4. Manter TC-009 nas verificações obrigatórias do pacote web.

## 13. Itens não verificados e artefatos

Não foram verificados o primeiro paint, `prefers-color-scheme: light`, estados
loading/erro no browser, contraste formal, teclado/foco, rota não encontrada,
matriz completa de viewports, browsers suportados, alvo WCAG formal nem a
estratégia futura de seleção de tema.

Artefato criado: `docs/testing/home-design-system.md`.
