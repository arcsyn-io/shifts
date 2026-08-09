# ADR-0005: Contexto aplicacional e transações declarativas

## Status

Proposta

## Contexto

As operações de organizations precisam executar em uma transação que configure a
role de runtime, a identidade autenticada e, quando aplicável, a organização
ativa usada pelas policies RLS. A implementação inicial torna esse limite
explícito com `OrganizationsUnitOfWork` e passa o principal em todos os
commands.

Essa abordagem preserva a segurança, mas repete a abertura do unit of work nos
services, acopla commands à identidade do transporte e permite que capacidades
futuras adotem formas diferentes de propagar o mesmo contexto. Providers do
NestJS são singleton por padrão; portanto, guardar principal, organização ou
transação diretamente em uma instância compartilhada causaria vazamento entre
requisições concorrentes.

## Decisão

1. A API terá um `ApplicationContext` singleton cuja implementação usa
   `AsyncLocalStorage.run()` para criar um store novo por execução.
2. No HTTP, um middleware abrirá o contexto antes dos guards. O
   `BffSessionGuard` será a única fronteira autorizada a definir o principal,
   obtido de uma sessão validada, com semântica write-once.
3. Commands de aplicação não transportarão o principal quando ele estiver
   disponível no contexto autenticado.
4. Métodos públicos que delimitam casos de uso persistentes usarão
   `@Transactional()`. A propagação padrão será `REQUIRED`: a primeira chamada
   abre a transação e chamadas aninhadas reutilizam exatamente o mesmo handle.
5. Somente o proprietário da transação poderá concluir commit ou rollback. Uma
   exceção propagada por qualquer participante causará rollback da operação.
6. Ao abrir a transação, o `TransactionManager` configurará, na mesma conexão e
   antes do SQL de negócio, a role de runtime, `app.current_user_id`,
   `app.current_organization_id` vazio e o contexto de lock vazio.
7. O `organizationId` será resolvido e autorizado no servidor. Sua seleção será
   write-once por transação e sincronizada imediatamente com
   `app.current_organization_id` usando configuração local à transação.
8. Repositories protegidos obterão o executor exclusivamente da transação ativa
   e falharão antes de emitir SQL quando não houver transação.
9. Operações de banco concorrentes com `Promise.all`, callbacks não aguardados e
   tarefas fire-and-forget não serão permitidas dentro da transação. Troca de
   organização e propagação `REQUIRES_NEW` também não serão suportadas.
10. MCP, jobs e outros adapters precisarão abrir um contexto e autenticar sua
    própria identidade. Até essa capacidade existir, não poderão executar
    operações tenant-specific.
11. Services e repositories continuarão singleton. Apenas o estado da execução
    será isolado pelo `AsyncLocalStorage`; não será usado `Scope.REQUEST`.
12. A API pública do contexto para os casos de uso será somente leitura. A
    capability que define o principal ficará restrita ao módulo de autenticação,
    e a capability que altera transação ou organização ficará privada à
    infraestrutura de banco, com allowlist no verificador arquitetural.

## Consequências positivas

- services deixam de repetir callbacks de unit of work e passagem de principal;
- identidade, transação e tenant possuem uma única política de propagação;
- providers singleton são preservados sem compartilhar estado entre requests;
- repositories passam a falhar de forma fechada fora do limite transacional;
- chamadas transacionais aninhadas preservam atomicidade e o mesmo contexto RLS.

## Consequências negativas

- o limite transacional fica parcialmente implícito e exige testes do decorator;
- tarefas assíncronas não aguardadas podem capturar o store e precisam ser
  proibidas;
- toda nova entrada, como MCP ou job, exige bootstrap explícito de contexto;
- a organização não pode ser trocada dentro da mesma transação;
- testes unitários de services precisam abrir um contexto autenticado.

## Alternativas rejeitadas

- manter o unit of work manual em cada service, pela repetição e acoplamento dos
  commands à identidade;
- usar provider com `Scope.REQUEST`, por propagar o escopo por todo o grafo de
  dependências e dificultar reutilização fora do HTTP;
- armazenar estado diretamente em singleton, pelo vazamento inevitável entre
  requisições;
- definir principal ou organização a partir do payload, pelo risco de
  impersonação e confused deputy;
- abrir transação independente em chamadas aninhadas, pela perda de atomicidade
  e divergência do contexto RLS.

## Validação

- requests concorrentes com principais distintos não compartilham estado;
- contexto permanece após `await` e desaparece ao concluir a execução;
- principal e organização rejeitam sobrescrita;
- chamada transacional aninhada reutiliza um único handle e o rollback externo
  desfaz toda a operação;
- repository fora da transação falha sem emitir SQL;
- commit, rollback e reutilização da conexão não preservam GUCs, locks ou role;
- testes PostgreSQL reais mantêm o isolamento cross-tenant com RLS;
- verificações arquiteturais impedem acesso direto ao banco fora do
  `TransactionManager`.
