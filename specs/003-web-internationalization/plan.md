# Plano: fundação de internacionalização do web

## Decisão técnica

Usar `i18next` com `react-i18next`, recursos locais e namespaces `common`,
`auth`, `home`, `status` e `notFound`. A alternativa de manter uma camada
própria foi descartada porque recriaria fallback, pluralização e integração com
React com maior custo de manutenção.

## Estrutura

- `shared/i18n`: instância, resolução/persistência do locale, seletor e
  recursos;
- `app/providers`: provider React da instância já inicializada;
- `pages` e `features`: consumo por `useTranslation`;
- `localStorage`: chave `arcsyn-shift.locale`, sem dados sensíveis;
- `<html lang>`: sincronizado com o locale ativo.

## Implementação e validação

1. Adicionar as dependências e catálogos `pt-BR`/`en`.
2. Inicializar os recursos locais de forma síncrona para evitar flash.
3. Adicionar seletor acessível na seção Preferências da modal de Configurações.
4. Migrar o copy visível atual e os atributos acessíveis.
5. Testar locale padrão, fallback configurado, persistência, troca e paridade.
6. Executar lint, arquitetura, typecheck, testes e build do monorepo.

Nenhuma migração de dados ou alteração de contrato é necessária.
