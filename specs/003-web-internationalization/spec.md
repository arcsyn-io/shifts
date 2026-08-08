# Especificação: fundação de internacionalização do web

**Status**: Rascunho **Data**: 2026-08-08

## Objetivo

Preparar `apps/web` para apresentar a interface em português brasileiro e
inglês, com troca em runtime, fallback previsível e preferência local, sem
alterar API, contratos ou persistência do produto.

## Requisitos

- **FR-001**: `pt-BR` deve ser o locale padrão.
- **FR-002**: `en` deve ser suportado e usado como fallback.
- **FR-003**: o usuário deve trocar o idioma sem recarregar a página.
- **FR-004**: a preferência deve ser restaurada de `localStorage` quando válida.
- **FR-005**: o atributo `lang` do documento deve refletir o locale ativo.
- **FR-006**: textos visíveis, validações e nomes acessíveis das superfícies
  existentes devem vir dos catálogos.
- **FR-007**: os catálogos devem ser locais ao bundle e separados por locale e
  namespace funcional.

## Fora do escopo

- preferência associada à conta ou persistida no backend;
- locale na URL, SEO localizado ou tradução de conteúdo criado por usuários;
- inclusão de idiomas além de `pt-BR` e `en`;
- tradução de códigos, logs e mensagens técnicas internas.

## Critérios de aceite

1. Sem preferência válida, a aplicação inicia em `pt-BR` sem flash em inglês.
2. O seletor em Configurações alterna toda a superfície atual entre `pt-BR` e
   `en` sem reload.
3. Após recarregar, o locale selecionado é restaurado.
4. Uma chave ausente no locale ativo usa `en` como fallback.
5. Login, home, estados de sessão, status e página não encontrada não mantêm
   copy visível hardcoded.
6. Testes cobrem padrão, troca, persistência e paridade estrutural dos
   catálogos.
