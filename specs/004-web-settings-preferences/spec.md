# Especificação: preferências nas configurações do web

**Status**: Rascunho **Data**: 2026-08-08

## Objetivo

Centralizar preferências locais de idioma e aparência em uma modal de
Configurações acessível pelo sidebar, usando os componentes e os seis temas
publicados pelo ArcSyn Design System.

## Requisitos

- **FR-001**: Configurações deve ser o único ponto de entrada autenticado para
  alterar idioma e tema.
- **FR-002**: o item Configurações do sidebar deve abrir uma modal, sem mudança
  de rota.
- **FR-003**: a modal deve ter navegação lateral com Preferências selecionada.
- **FR-004**: Preferências deve permitir selecionar `pt-BR` ou `en`.
- **FR-005**: Preferências deve exibir e permitir selecionar os temas `light`,
  `dark`, `deep-dark`, `corporate-dark`, `catppuccin-mocha` e
  `catppuccin-latte`.
- **FR-006**: cada tema deve possuir nome, estado selecionado e preview
  renderizado pelos tokens do próprio tema.
- **FR-007**: alterações devem ser aplicadas imediatamente e persistidas em
  `localStorage`.
- **FR-008**: valores persistidos ausentes ou inválidos devem usar `pt-BR` e
  `dark`.

## Fora do escopo

- sincronização das preferências com conta ou backend;
- criação ou alteração de temas no Design System;
- novas seções funcionais de Configurações;
- desfazer alterações ao fechar a modal.

## Critérios de aceite

1. Login e topbar não exibem seletores de idioma ou tema.
2. Configurações abre a modal com Preferências ativa.
3. Idioma e tema mudam sem reload e permanecem após recarregar.
4. Os seis temas do contrato público `ThemeSwitcherTheme` são apresentados com
   preview e indicação que não depende apenas de cor.
5. A modal fecha por botão e `Escape`, mantém o foco dentro enquanto aberta e
   devolve o foco ao acionador ao fechar.
6. A estrutura permanece utilizável em viewport estreito e por teclado.
7. Testes cobrem valores padrão, persistência, catálogo de temas e composição da
   modal.
