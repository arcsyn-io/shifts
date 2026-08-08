# ADR-0004: Tenancy compartilhada com RBAC e RLS por organização

## Status

Proposta

## Contexto

O produto precisa permitir que uma identidade participe de várias organizações,
com papel independente em cada vínculo. Convites, revogações e funcionalidades
futuras devem respeitar a organização ativa. A autenticação Supabase identifica
o usuário, mas não representa autorização organizacional atual.

Somente filtros na aplicação deixam o isolamento vulnerável a omissões. Somente
RLS, por outro lado, não expressa adequadamente a matriz de ações nem produz
erros de domínio úteis. A API usa pool de conexões, então contexto persistente
em sessão também poderia vazar entre requisições.

## Decisão

1. Organizações compartilharão o schema de aplicação e dados tenant-specific
   terão `organization_id` obrigatório.
2. O vínculo N:N armazenará o papel `owner`, `admin` ou `member`; permissões
   serão calculadas a partir do estado atual no banco, não de claims do JWT.
3. A aplicação aplicará RBAC explicitamente nos casos de uso e o PostgreSQL
   aplicará RLS default-deny como defesa adicional.
4. Principal e organização serão definidos com configuração local à transação;
   nunca permanecerão como estado de sessão da conexão devolvida ao pool.
5. Tabelas protegidas usarão `ENABLE ROW LEVEL SECURITY` e
   `FORCE ROW LEVEL SECURITY`.
6. A aplicação usará role de runtime `NOBYPASSRLS`, sem superuser e sem
   ownership das tabelas. A role de migração/owner será separada e não será
   usada pelo runtime.
7. Helpers `SECURITY DEFINER`, quando inevitáveis para evitar recursão de
   policy, terão owner `NOLOGIN` dedicado, `search_path` fixo, entrada validada
   e grants mínimos. Esse owner poderá usar `BYPASSRLS` somente para leitura das
   quatro tabelas desta capacidade; não receberá escrita, ownership ou login. As
   funções serão a única superfície executável concedida ao runtime.
8. Slug é globalmente único, case-insensitive e imutável neste MVP. A URL
   canônica é `/organizations/:slug`.
9. Revogação preservará auditoria e terá efeito nas requisições seguintes. Não
   haverá auto-saída.
10. A organização manterá pelo menos um owner; alterações concorrentes devem
    impedir remoção ou rebaixamento do último owner.

## Consequências positivas

- autorização reflete revogações sem depender da expiração do token;
- falhas de filtro na aplicação continuam limitadas por RLS;
- uma identidade pode assumir papéis diferentes em organizações diferentes;
- URL por slug permite acesso direto e contexto legível.

## Consequências negativas

- toda operação tenant-specific precisa de transação e contexto explícito;
- migrações e testes precisam comprovar grants, ownership e comportamento RLS;
- os helpers RLS formam um limite privilegiado pequeno que exige revisão a cada
  alteração de assinatura, grant ou tabela consultada;
- invariantes concorrentes de ownership exigem lock e validação no banco;
- suporte futuro a renomeação de slug exigirá aliases ou redirects.

## Alternativas rejeitadas

- autorização somente na aplicação, por não satisfazer defesa em profundidade;
- autorização somente por RLS, por não substituir regras e respostas de domínio;
- papel no JWT, por permanecer obsoleto após alteração ou revogação;
- schema ou banco por organização, pelo custo operacional desproporcional ao
  estágio atual.

## Validação

- testes negativos de acesso cruzado e consulta sem filtro;
- teste da role runtime comprovando `NOSUPERUSER`, `NOBYPASSRLS` e ausência de
  ownership;
- teste de reutilização do pool sem vazamento de contexto;
- matriz RBAC por papel e ação;
- testes concorrentes de aceite, revogação e último owner.
