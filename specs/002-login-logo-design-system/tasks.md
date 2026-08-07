# Tarefas: logo oficial do Design System no login

**Entrada**: documentos de design em `specs/002-login-logo-design-system/`

**Pré-requisitos**: [plan.md](plan.md), [spec.md](spec.md),
[research.md](research.md), [data-model.md](data-model.md),
[contracts/login-logo-ui.md](contracts/login-logo-ui.md) e
[quickstart.md](quickstart.md)

**Testes**: a especificação exige validação automatizada do contrato visual,
build do asset, matriz responsiva, acessibilidade e regressão do login.

**Organização**: as tarefas estão agrupadas por história de usuário. A mudança
deve ter um único proprietário em `apps/web` e `pnpm-lock.yaml` para evitar
conflitos entre arquivos compartilhados.

## Formato: `[ID] [P?] [História] Descrição`

- **[P]**: pode ser executada em paralelo por alterar arquivos diferentes e não
  depender de outra tarefa incompleta no mesmo grupo.
- **[US1]**, **[US2]**, **[US3]**: história de usuário correspondente em
  [spec.md](spec.md).
- Todas as tarefas indicam os caminhos exatos afetados ou usados como evidência.

## Fase 1: Preparação

**Objetivo**: disponibilizar o contrato oficial do asset no menor consumidor.

- [x] T001 Adicionar `@arcsyn-io/presentations@0.1.0` como dependência direta de
      `@arcsyn-shift/web` usando pnpm e revisar somente as alterações geradas em
      `apps/web/package.json` e `pnpm-lock.yaml`

---

## Fase 2: Fundação bloqueante

**Objetivo**: confirmar que o pacote oficial pode ser instalado de forma
reproduzível e segura antes de escrever consumidores.

**⚠️ CRÍTICO**: nenhuma história pode começar até esta fase terminar.

- [x] T002 Validar `pnpm install --frozen-lockfile --ignore-scripts`, conferir
      versão exata, URL e integridade do pacote em `pnpm-lock.yaml` e confirmar
      que `.github/workflows/ci.yml` e `docs/operations/deploy-vercel.md` mantêm
      acesso somente `read:packages`, sem fallback remoto

**Checkpoint**: o asset oficial está resolvido pelo lockfile e disponível para o
build do web.

---

## Fase 3: História de usuário 1 — Reconhecer a marca oficial no login (P1) 🎯 MVP

**Objetivo**: substituir todas as representações locais pela imagem oficial do
Design System nos dois pontos atuais do login.

**Teste independente**: abrir `/login` em uma viewport móvel e uma desktop e
confirmar que ambas usam o asset de `@arcsyn-io/presentations/logo.png`, sem SVG
ou texto que redesenhe a marca.

### Testes da história 1

- [x] T003 [US1] Criar em `apps/web/test/login-logo.test.ts` o contrato
      automatizado da fonte oficial, dos dois consumidores e da ausência de
      geometria local ou URL externa, verificando que o teste detecta a
      implementação atual baseada em `ArcSynBrand`

### Implementação da história 1

- [x] T004 [US1] Criar `apps/web/src/features/auth/components/ArcSynLogo.tsx`
      como componente de imagem simples que importa exclusivamente
      `@arcsyn-io/presentations/logo.png`, sem importar a raiz JavaScript do
      pacote nem reproduzir geometria da marca
- [x] T005 [P] [US1] Substituir `ArcSynBrand` por `ArcSynLogo` no cabeçalho do
      formulário em `apps/web/src/features/auth/components/LoginForm.tsx`,
      preservando a estrutura e o comportamento do formulário
- [x] T006 [P] [US1] Substituir `ArcSynBrand` por `ArcSynLogo` no hero em
      `apps/web/src/features/auth/components/LoginHero.tsx`, preservando textos,
      ilustração e estrutura semântica
- [x] T007 [US1] Remover `apps/web/src/features/auth/components/ArcSynBrand.tsx`
      e confirmar em `apps/web/src/` que não restam importações, renderizações,
      SVG ou texto exclusivos da representação local da marca

**Checkpoint**: a história 1 entrega a logo oficial nos dois pontos e pode ser
demonstrada sem a representação local.

---

## Fase 4: História de usuário 2 — Usar o login em qualquer viewport (P2)

**Objetivo**: preservar a alternância mobile/desktop e enquadrar corretamente o
canvas transparente do PNG oficial.

**Teste independente**: validar `/login` em `320 × 800`, `831 × 900`,
`832 × 900` e `1440 × 900`, confirmando uma única logo visível, sem corte de
pixels, distorção, sobreposição ou overflow horizontal.

### Testes da história 2

- [x] T008 [US2] Estender `apps/web/test/login-logo.test.ts` com o contrato do
      breakpoint `52rem`, dos seletores de visibilidade e da preservação de
      proporção do asset antes de alterar
      `apps/web/src/shared/styles/global.css`

### Implementação da história 2

- [x] T009 [US2] Substituir os estilos `.arcsyn-brand` e `.arcsyn-brand__mark`
      pelos estilos de enquadramento de `ArcSynLogo` em
      `apps/web/src/shared/styles/global.css`, ocultando somente transparência
      do canvas e preservando o breakpoint, a proporção e os pixels visíveis
- [x] T010 [US2] Executar em `specs/002-login-logo-design-system/quickstart.md`
      a matriz responsiva contra `apps/web/src/shared/styles/global.css` e
      ajustar o enquadramento até não haver duplicidade, lacuna, corte,
      distorção ou overflow

**Checkpoint**: a história 2 funciona nos quatro estados de viewport sem alterar
o restante da composição do login.

---

## Fase 5: História de usuário 3 — Identificar a marca com tecnologia assistiva (P2)

**Objetivo**: expor exatamente uma identificação acessível “ArcSyn” em cada
estado responsivo.

**Teste independente**: inspecionar a árvore de acessibilidade abaixo e a partir
de `52rem` e encontrar uma única marca com nome acessível `ArcSyn`.

### Testes da história 3

- [x] T011 [US3] Estender `apps/web/test/login-logo.test.ts` para exigir o nome
      acessível exato `ArcSyn`, proibir texto alternativo vazio ou redundante e
      vincular a instância oculta aos ancestrais responsivos de
      `apps/web/src/features/auth/components/LoginForm.tsx` e
      `apps/web/src/features/auth/components/LoginHero.tsx`

### Implementação da história 3

- [x] T012 [US3] Ajustar `apps/web/src/features/auth/components/ArcSynLogo.tsx`,
      `apps/web/src/features/auth/components/LoginForm.tsx`,
      `apps/web/src/features/auth/components/LoginHero.tsx` e
      `apps/web/src/shared/styles/global.css` para que somente a instância
      visível possua presença na árvore de acessibilidade, sem alterar ordem de
      foco ou semântica do formulário

**Checkpoint**: todas as histórias estão implementadas e a marca é percebida uma
única vez tanto visualmente quanto por tecnologia assistiva.

---

## Fase 6: Acabamento e validações transversais

**Objetivo**: provar empacotamento, segurança operacional, ausência de regressão
e atendimento aos critérios de sucesso.

- [x] T013 Executar `pnpm --filter @arcsyn-shift/web lint`,
      `pnpm --filter @arcsyn-shift/web typecheck`,
      `pnpm --filter @arcsyn-shift/web test` e
      `pnpm --filter @arcsyn-shift/web build` para validar
      `apps/web/package.json` e registrar os resultados reais
- [x] T014 Inspecionar `apps/web/dist/assets/` após o build e confirmar
      exatamente um PNG da logo, servido same-origin, com tamanho e SHA-256
      compatíveis com `specs/002-login-logo-design-system/research.md`, sem URLs
      de registry, GitHub ou CDN nos artefatos
- [x] T015 Validar conforme `specs/002-login-logo-design-system/quickstart.md` a
      rede, a árvore de acessibilidade e as viewports, registrando evidências
      antes/depois em `320 × 800` e `1440 × 900` sem adicionar screenshots ao
      repositório
- [ ] T016 Repetir com `apps/web/test/auth-api.test.ts` e
      `apps/web/test/auth-redirect.test.ts` os cenários de envio válido,
      credenciais inválidas, falha de conexão, loading, redirecionamento e foco
      descritos em `specs/002-login-logo-design-system/quickstart.md`,
      complementando com execução local como evidência de ausência de regressão

      **Parcial em 2026-08-06**: os 11 testes direcionados de API e redirect
                  passaram, e o preview confirmou o estado de indisponibilidade do serviço.
                  A execução local sem backend não permitiu repetir credenciais inválidas e
                  login bem-sucedido de ponta a ponta; por isso esta tarefa permanece aberta.

---

## Dependências e ordem de execução

### Dependências entre fases

- **Preparação (Fase 1)**: pode começar imediatamente.
- **Fundação (Fase 2)**: depende de T001 e bloqueia todas as histórias.
- **US1 (Fase 3)**: depende da fundação; cria o componente e os consumidores
  usados pelas demais histórias.
- **US2 (Fase 4)**: depende da US1 para ajustar o asset já integrado.
- **US3 (Fase 5)**: depende da US1 e da visibilidade concluída na US2.
- **Acabamento (Fase 6)**: depende das histórias selecionadas para a entrega; a
  validação completa depende de US1, US2 e US3.

### Dependências entre histórias

```text
Setup → Fundação → US1 (P1) → US2 (P2) → US3 (P2) → Validação final
```

- **US1** é o MVP e não depende de outra história.
- **US2** depende do componente e dos dois consumidores entregues pela US1.
- **US3** depende dos ancestrais e seletores responsivos consolidados por US2
  para provar ausência de duplicidade na árvore de acessibilidade.

### Ordem dentro de cada história

- Escrever ou estender o teste de contrato antes da mudança correspondente.
- Criar `ArcSynLogo` antes de atualizar seus consumidores.
- T005 e T006 podem ocorrer em paralelo depois de T004.
- Remover `ArcSynBrand` somente depois que os dois consumidores forem migrados.
- Ajustar CSS antes da validação visual e de acessibilidade renderizada.
- Concluir verificações automatizadas antes de inspecionar os artefatos do
  build.

### Oportunidades de paralelização

- Após T004, executar T005 e T006 em paralelo porque alteram arquivos distintos.
- As revisões de evidências móvel e desktop de T015 podem ser divididas entre
  pessoas, mantendo uma única responsável pelas alterações de código.
- Não paralelizar T008, T011 ou qualquer outra tarefa que edite
  `apps/web/test/login-logo.test.ts`.
- Não paralelizar mudanças em `pnpm-lock.yaml` com outras instalações de
  dependências.

## Exemplo de execução paralela: história 1

Depois de T004:

```text
Tarefa T005: atualizar LoginForm.tsx para usar ArcSynLogo
Tarefa T006: atualizar LoginHero.tsx para usar ArcSynLogo
```

As duas alterações devem ser reunidas antes de T007 remover o componente antigo.

## Estratégia de implementação

### MVP primeiro

1. Concluir T001–T002 para disponibilizar o pacote oficial.
2. Concluir T003–T007 para entregar a US1.
3. Parar e validar a fonte do asset em mobile e desktop.
4. Não publicar o MVP se ele introduzir regressão crítica de acessibilidade ou
   layout; nesses casos, avançar US2 e US3 antes da entrega.

### Entrega incremental

1. **US1**: fonte oficial e remoção da geometria local.
2. **US2**: enquadramento e transição responsiva completos.
3. **US3**: contrato de acessibilidade completo.
4. **Acabamento**: build, segurança operacional, evidências e regressão.

## Rastreabilidade

| História    | Requisitos principais                    | Tarefas   |
| ----------- | ---------------------------------------- | --------- |
| US1         | FR-001, FR-006, FR-007, NFR-001          | T003–T007 |
| US2         | FR-002, FR-003, FR-004, NFR-002, NFR-004 | T008–T010 |
| US3         | FR-005, NFR-003                          | T011–T012 |
| Transversal | FR-008, SC-001–SC-005                    | T013–T016 |

## Observações

- O marcador `[P]` aparece somente quando os arquivos e dependências permitem
  execução simultânea segura.
- Nenhuma tarefa autoriza commit, push, alteração de ambiente externo ou edição
  do repositório do Design System.
- A eventual ausência de `read:packages` em CI ou Vercel bloqueia a entrega e
  não autoriza fallback por URL externa.
- A implementação deve permanecer sob propriedade única do `frontend_developer`,
  conforme o plano.
