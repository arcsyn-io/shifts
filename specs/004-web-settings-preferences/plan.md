# Plano: preferências nas configurações do web

## Decisão técnica

Manter idioma em `shared/i18n` e criar `shared/theme` como infraestrutura local
de validação, aplicação e persistência. A modal pertence a `features/settings` e
é composta pela Home sem introduzir rota ou contrato de backend.

O Design System não exporta uma constante com os temas, apenas o tipo público
`ThemeSwitcherTheme`. Por isso, o web mantém um catálogo exaustivo tipado por
esse contrato. Os previews recebem `data-arcsyn-theme` individualmente e usam
somente tokens semânticos, evitando copiar cores ou implementar temas paralelos.

## Implementação e validação

1. Inicializar o tema persistido antes da montagem do React e manter `dark` como
   fallback.
2. Criar a modal com Dialog e RadioGroup do Design System.
3. Montar navegação lateral extensível com Preferências ativa.
4. Reaproveitar o seletor de locale e construir a grade de previews dos temas.
5. Habilitar Configurações no sidebar e remover controles duplicados.
6. Validar foco, teclado, responsividade, persistência, catálogos, testes e
   build.
