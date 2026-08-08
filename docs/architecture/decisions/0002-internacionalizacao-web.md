# ADR-0002: internacionalização da aplicação web

**Status**: Proposta **Data**: 2026-08-08

## Contexto

O frontend possui textos em português e inglês distribuídos entre páginas e
features. A evolução do produto exige locale consistente, troca em runtime,
fallback e formatação futura sem duplicar infraestrutura em cada capacidade.

## Decisão proposta

Adotar `i18next` e `react-i18next` somente em `apps/web`, com:

- `pt-BR` como locale padrão e `en` como fallback;
- catálogos locais separados por locale e namespace funcional;
- integração global na camada `app` e infraestrutura em `shared/i18n`;
- preferência não sensível em `localStorage`;
- seletor centralizado em Configurações, sem controles duplicados nas páginas;
- chaves semânticas e estáveis, independentes do texto traduzido.

## Consequências

Há duas dependências adicionais e uma convenção transversal a manter. Em troca,
o projeto passa a contar com pluralização, interpolação, fallback, hooks React e
um caminho conhecido para novos locales. A preferência permanece restrita ao
dispositivo até existir requisito explícito de sincronização com a conta.

Esta ADR permanece como **Proposta** até aprovação explícita.
