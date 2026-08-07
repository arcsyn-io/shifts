# Especificação da funcionalidade: logo oficial do Design System no login

**Feature Branch**: não criada; extensão Git do Spec Kit não habilitada

**Criada em**: 2026-08-06

**Status**: Rascunho

**Entrada**: solicitação para substituir a representação local `ArcSynBrand`
pela logo oficial do ArcSyn Design System na tela de login.

## Cenários de usuário e testes _(obrigatório)_

### História de usuário 1 — Reconhecer a marca oficial no login (Prioridade: P1)

Como usuário não autenticado, quero ver a marca oficial ArcSyn ao acessar o
login para reconhecer que estou entrando no produto correto e ter uma
experiência visual coerente com os demais produtos ArcSyn.

**Por que esta prioridade**: a finalidade da mudança é eliminar a divergência
entre a marca oficial e a representação criada localmente.

**Teste independente**: acessar `/login` em uma viewport móvel e em uma desktop
e comparar a marca exibida com a fonte oficial disponibilizada pelo Design
System.

**Cenários de aceite**:

1. **Dado** que o usuário acessa `/login` em uma viewport menor que `52rem`,
   **quando** a página termina de carregar, **então** a logo oficial ArcSyn é
   exibida no cabeçalho do formulário.
2. **Dado** que o usuário acessa `/login` em uma viewport a partir de `52rem`,
   **quando** a página termina de carregar, **então** a logo oficial ArcSyn é
   exibida no hero.
3. **Dado** qualquer estado responsivo suportado, **quando** a logo é exibida,
   **então** sua geometria, proporção, cores e transparência correspondem à
   fonte oficial do Design System, sem reprodução aproximada da marca.

---

### História de usuário 2 — Usar o login em qualquer viewport (Prioridade: P2)

Como usuário de dispositivo móvel ou desktop, quero que a logo ocupe a posição
prevista para cada layout sem prejudicar o formulário ou o conteúdo do hero.

**Por que esta prioridade**: a troca da marca não pode degradar a composição
responsiva nem criar duas marcas concorrentes na mesma experiência.

**Teste independente**: validar `/login` em `320px`, imediatamente abaixo de
`52rem`, em `52rem` e em uma viewport desktop ampla, verificando posição,
visibilidade, proporção e ausência de overflow.

**Cenários de aceite**:

1. **Dado** uma viewport menor que `52rem`, **quando** o login é exibido,
   **então** o hero permanece oculto e existe exatamente uma logo visível no
   cabeçalho do formulário.
2. **Dado** uma viewport a partir de `52rem`, **quando** o login é exibido,
   **então** existe exatamente uma logo visível no hero e a instância reservada
   ao formulário permanece oculta.
3. **Dado** qualquer viewport suportada, **quando** o usuário visualiza a
   página, **então** a logo não apresenta corte, distorção, sobreposição nem
   provoca rolagem horizontal.

---

### História de usuário 3 — Identificar a marca com tecnologia assistiva (Prioridade: P2)

Como usuário de tecnologia assistiva, quero que a marca seja identificada uma
única vez como “ArcSyn” para compreender o contexto da página sem anúncios
duplicados ou ruído decorativo.

**Por que esta prioridade**: a responsividade mantém posições alternativas para
a marca, mas apenas a instância relevante deve ser percebida pelo usuário.

**Teste independente**: inspecionar a árvore de acessibilidade nos estados móvel
e desktop e confirmar uma única identificação da marca em cada estado.

**Cenários de aceite**:

1. **Dado** que a logo visível comunica a identidade do produto, **quando** a
   árvore de acessibilidade é consultada, **então** ela possui o nome acessível
   “ArcSyn”.
2. **Dado** que o layout mantém posições alternativas para a logo, **quando**
   uma delas está oculta visualmente, **então** ela não produz uma segunda
   identificação da marca para tecnologia assistiva.

### Casos-limite

- A logo oficial pode possuir transparência ou espaço interno diferente da
  representação atual; ela deve permanecer legível sem alterar sua proporção.
- No ponto exato de transição em `52rem`, apenas a posição desktop deve ficar
  visível, sem intervalo vazio ou duplicidade.
- Se a fonte oficial não estiver disponível por um contrato versionado e
  apropriado para a aplicação web, a implementação deve permanecer bloqueada até
  que essa dependência seja fornecida; não deve recorrer silenciosamente a uma
  cópia, redesenho ou URL externa.
- Falhas de empacotamento da logo devem ser detectadas antes da entrega e não
  resultar em imagem quebrada em produção.

## Requisitos _(obrigatório)_

### Requisitos funcionais

- **FR-001**: a tela `/login` deve usar a logo oficial fornecida pelo ArcSyn
  Design System em todas as posições atualmente destinadas à marca ArcSyn.
- **FR-002**: abaixo de `52rem`, a logo deve aparecer no cabeçalho do formulário
  e o hero deve permanecer oculto.
- **FR-003**: a partir de `52rem`, a logo deve aparecer no hero e a posição da
  marca no formulário deve permanecer oculta.
- **FR-004**: cada estado responsivo deve apresentar exatamente uma logo ArcSyn
  visível.
- **FR-005**: a logo percebida por tecnologia assistiva deve possuir o nome
  acessível “ArcSyn”, sem anúncio duplicado no mesmo estado responsivo.
- **FR-006**: a aplicação não deve conservar ou introduzir uma reprodução local
  da geometria da marca como substituta da fonte oficial.
- **FR-007**: a logo deve fazer parte dos artefatos entregues pela aplicação e
  não depender de CDN ou host externo durante a execução.
- **FR-008**: autenticação, validação do formulário, estados de carregamento e
  erro, sessão e redirecionamento após login devem manter o comportamento atual.

### Requisitos não funcionais

- **NFR-001 — Fidelidade visual**: a logo deve preservar a geometria, as cores,
  a transparência e a proporção definidas pelo Design System, sem corte,
  recoloração ou distorção.
- **NFR-002 — Responsividade**: a mudança não deve introduzir overflow
  horizontal, sobreposição ou deslocamento que prejudique o formulário ou o hero
  em viewports suportadas.
- **NFR-003 — Acessibilidade**: a marca deve permanecer identificável sem texto
  alternativo redundante ou duplicidade na árvore de acessibilidade.
- **NFR-004 — Consistência**: a mudança deve preservar o tema dark, a
  tipografia, o breakpoint e a composição responsiva existentes na página de
  login.

## Limites de escopo

### Dentro do escopo

- substituir as duas posições responsivas atualmente ocupadas pela representação
  local da marca;
- ajustar somente dimensões, visibilidade e espaçamento necessários para a logo
  oficial;
- eliminar a representação local e estilos exclusivos que deixarem de ter uso;
- validar visualmente as experiências móvel e desktop.

### Fora do escopo

- redesenhar o formulário, o hero ou a ilustração decorativa;
- alterar textos, tema, tipografia, proporção desktop ou breakpoint;
- mudar autenticação, sessão, redirects, APIs, contratos, banco de dados ou
  observabilidade;
- criar, redesenhar ou recolorir uma variante da logo;
- alterar componentes do Design System sem relação direta com a distribuição
  oficial da marca.

## Critérios de sucesso _(obrigatório)_

### Resultados mensuráveis

- **SC-001**: em `320px`, imediatamente abaixo de `52rem`, em `52rem` e em uma
  viewport desktop ampla, 100% dos estados validados apresentam exatamente uma
  logo oficial visível, sem corte, distorção ou overflow horizontal.
- **SC-002**: em cada estado responsivo validado, a árvore de acessibilidade
  contém exatamente uma identificação “ArcSyn” associada à marca visível.
- **SC-003**: a comparação visual de antes e depois em pelo menos uma viewport
  móvel e uma desktop confirma correspondência com a fonte oficial do Design
  System e preservação do restante do layout.
- **SC-004**: os fluxos existentes de envio válido, credenciais inválidas, falha
  de conexão, carregamento e navegação pós-login continuam produzindo os mesmos
  resultados observáveis após a mudança.
- **SC-005**: nenhuma requisição de rede para domínio externo é necessária para
  exibir a logo durante o uso da aplicação.

## Hipóteses e dependências

- A solicitação abrange as duas posições atuais da marca na tela de login: o
  cabeçalho do formulário em telas estreitas e o hero em telas amplas.
- A marca é informativa no contexto do login e, por isso, deve ser anunciada
  como “ArcSyn” na instância visível.
- O layout atual, incluindo o breakpoint de `52rem`, permanece como fonte de
  verdade para a posição responsiva da marca.
- A implementação depende de uma forma oficial, versionada e apropriada para
  aplicações web de consumir a logo do Design System. A definição do pacote ou
  export concreto pertence ao plano técnico e deve ser resolvida antes da
  implementação.
- A especificação refina o requisito visual já registrado para o login, sem
  alterar sua jornada funcional.
