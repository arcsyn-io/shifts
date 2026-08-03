# Operação da autenticação

## Limites

Este runbook cobre rotação do segredo JWT, revogação de sessões e limpeza dos
registros de autenticação. Execute os comandos no banco do ambiente correto com
uma role operacional aprovada; nunca use a credencial de runtime da API nem
registre segredos, cookies ou tokens nas evidências.

As operações devem ocorrer primeiro em homologação. Em produção, mantenha um
segundo operador para conferir ambiente, escopo e resultado antes do `COMMIT`.

## Rotação do segredo JWT

`AUTH_JWT_SECRET` assina somente access tokens de até 10 minutos. O refresh
token persistido não depende desse segredo.

1. Gere 32 bytes aleatórios em base64url no gerenciador de segredos aprovado.
2. Atualize `AUTH_JWT_SECRET` em todas as instâncias do mesmo ambiente, sem
   alterar `AUTH_RATE_LIMIT_SECRET`, issuer ou audience.
3. Publique API e web dentro da mesma janela. A troca invalida access tokens
   antigos; o cliente deve renovar a sessão usando o refresh cookie.
4. Valide login, sessão e refresh sem registrar valores de cookies.
5. Remova a versão anterior do segredo depois de confirmar que nenhuma instância
   antiga permanece ativa.

Se houver suspeita de comprometimento, revogue também todas as famílias pelo
procedimento seguinte. A rotação normal do JWT, isoladamente, não encerra
refresh tokens.

## Revogação global

Para encerrar todas as sessões de um ambiente:

```sql
BEGIN;

UPDATE auth_refresh_token_families
SET revoked_at = COALESCE(revoked_at, now()),
    updated_at = now()
WHERE revoked_at IS NULL;

COMMIT;
```

Registre somente ambiente, horário, operador e quantidade de linhas afetadas.
Access tokens emitidos antes da revogação podem permanecer válidos por até 10
minutos; em incidente, combine a revogação com a rotação do segredo JWT.

Para desativar uma conta e revogar imediatamente seus refresh tokens, execute a
alteração em uma única transação, substituindo o parâmetro sem expor dados em
logs:

```sql
BEGIN;

UPDATE users
SET is_active = false,
    updated_at = now()
WHERE id = :'user_id';

UPDATE auth_refresh_token_families
SET revoked_at = COALESCE(revoked_at, now()),
    updated_at = now()
WHERE user_id = :'user_id'
  AND revoked_at IS NULL;

COMMIT;
```

## Limpeza idempotente

A retenção operacional é de 30 dias após expiração ou revogação. Execute a
rotina periodicamente fora do caminho das requisições:

```sql
BEGIN;

WITH doomed_families AS (
  SELECT id
  FROM auth_refresh_token_families
  WHERE expires_at < now() - interval '30 days'
     OR revoked_at < now() - interval '30 days'
)
DELETE FROM auth_refresh_tokens AS token
USING doomed_families AS family
WHERE token.family_id = family.id;

DELETE FROM auth_refresh_token_families
WHERE expires_at < now() - interval '30 days'
   OR revoked_at < now() - interval '30 days';

DELETE FROM auth_rate_limits
WHERE updated_at < now() - interval '30 days';

COMMIT;
```

A rotina pode ser repetida sem erro e não remove famílias ativas. Monitore
duração, bloqueios e quantidade de linhas; interrompa e faça `ROLLBACK` se o
plano atingir famílias não expiradas ou se houver contenção anormal. O
agendamento automatizado e seus alertas dependem da plataforma de banco aprovada
para o ambiente.

## Evidências e retorno

Depois de qualquer operação, valide login, refresh, logout e contagem de
famílias ativas. Não copie payloads ou headers sensíveis. A revogação e a
limpeza são alterações de dados e não devem ser revertidas automaticamente; se o
procedimento falhar antes do `COMMIT`, execute `ROLLBACK`, investigue e só
repita após corrigir a causa.
