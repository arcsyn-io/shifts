# ADR-0004: Casos de uso de orquestração na camada de aplicação

- **Status:** Aceita
- **Data:** 2026-08-03
- **Responsáveis:** equipe de desenvolvimento do ArcSyn Shift
- **Funcionalidade relacionada:** decomposição das operações públicas de
  autenticação

## Contexto

A ADR-0001 reservou `domain/use-cases` para casos de uso independentes de
framework, transporte e persistência, enquanto `application` concentra services
e coordena domínio e repositórios. O módulo de autenticação passou a reunir
login, rotação de token, logout, verificação técnica de JWT e mapeamento HTTP em
um único `AuthService`.

Essas operações possuem ciclos de dependência e testes distintos. Login, refresh
e logout orquestram repositório, criptografia, configuração e observabilidade,
portanto não satisfazem o isolamento exigido para `domain/use-cases`. Mantê-las
como métodos públicos de um service agregador também dificulta declarar as
dependências mínimas de cada operação.

## Forças de decisão

- Representar cada operação pública de aplicação por uma unidade coesa.
- Preservar `domain/use-cases` para regras puras e independentes de framework.
- Permitir injeção de dependências e composição pelo NestJS nas orquestrações.
- Reutilizar os mesmos casos de uso entre adaptadores de apresentação.
- Manter mapeamentos de protocolo e verificações técnicas nas fronteiras
  apropriadas.

## Alternativas consideradas

### Manter services agregadores

Conservar múltiplas operações públicas em um service por módulo. A composição é
simples, porém as dependências e responsabilidades crescem em conjunto e
operações independentes ficam acopladas.

### Colocar toda operação em `domain/use-cases`

Usar apenas a pasta já definida pela ADR-0001. Isso uniformiza nomes, mas força
casos de uso que coordenam persistência, configuração e observabilidade a violar
o isolamento do domínio ou cria abstrações sem necessidade comprovada.

### Distinguir casos de uso de aplicação e de domínio

Permitir casos de uso de orquestração em `application/use-cases` e manter casos
de uso puros em `domain/use-cases`. Ambos usam o sufixo `*.use-case.ts`; os
casos de uso de aplicação podem participar da composição NestJS e dependem
somente das camadas já permitidas para `application`.

## Decisão

Adotar `application/use-cases` para operações públicas que orquestram serviços
técnicos, repositórios ou limites transacionais. Cada classe representa uma
operação e expõe um único método público `execute`, recebendo Command e
retornando Result quando esses artefatos forem necessários.

Preservar `domain/use-cases` para regras executáveis sem dependência de NestJS,
transporte, infraestrutura ou persistência. Services de `application` continuam
válidos para capacidades técnicas coesas compartilhadas por casos de uso; não
devem atuar como agregadores de operações públicas sem uma responsabilidade
única.

No módulo de autenticação, login, refresh e logout tornam-se casos de uso de
aplicação independentes. O guard HTTP usa diretamente o serviço técnico de token
para verificação de JWT e CSRF. A conversão de resultados para o contrato HTTP
fica em mapper puro da apresentação.

## Consequências positivas

- Dependências mínimas e efeitos de cada operação ficam explícitos.
- Casos de uso podem ser consumidos igualmente pelos adaptadores HTTP e MCP.
- Testes unitários ficam alinhados às operações públicas.
- O domínio permanece isolado de composição e detalhes técnicos.

## Consequências negativas

- A composição NestJS registra mais providers.
- Operações pequenas passam a ocupar arquivos separados.
- A distinção entre caso de uso de aplicação e de domínio exige julgamento pela
  natureza das dependências.

## Riscos e mitigação

- **Caso de uso de aplicação virar um novo agregador:** limitar cada classe a um
  método público `execute` e a uma operação.
- **Regra de domínio migrar indevidamente para application:** manter regras
  puras em `domain/use-cases` e revisar a direção das dependências.
- **Duplicação entre transportes:** controllers e ferramentas MCP devem delegar
  aos mesmos casos de uso.
- **Mudança comportamental durante a decomposição:** preservar Commands,
  Results, códigos de erro, eventos, transações e testes de segurança.

## Impactos

### Contratos e frontend

Nenhuma alteração em rotas, status HTTP, cookies ou respostas públicas.

### Backend

O validador arquitetural passa a aceitar `*.use-case.ts` em
`application/use-cases` e `domain/use-cases`. O módulo de autenticação substitui
o service agregador por três providers de caso de uso.

### Dados e infraestrutura

Nenhuma alteração de esquema, migração, conexão ou topologia operacional.

### Segurança

As regras de rate limit, validação de credenciais, rotação atômica, detecção de
replay, revogação idempotente, precedência de refresh sobre access token e
proteções de JWT e CSRF são preservadas.

## Evidências de validação

- O checker aceita casos de uso nas duas localizações e continua rejeitando-os
  fora delas.
- Login e refresh preservam sucessos, rejeições e rate limits.
- Logout processa no máximo uma credencial, prioriza refresh token e registra um
  único evento de conclusão.
- O guard mantém validação técnica de JWT e vínculo de CSRF.
- Architecture check, lint, typecheck e testes da API são aprovados.
