# lib/api/

Helpers e convenções compartilhadas por toda rota `/api/v1/*`.

- `wrappers.ts` — `ok(data, opts)` / `fail(code, message, status, opts)` / `noContent()` + tipos `ApiSuccess<T>` / `ApiError`
- `errors.ts` — `ApiErrorCodes` (constante canônica de códigos)

## Exemplo

```ts
import { ok, fail } from "@/lib/api/wrappers";
import { ApiErrorCodes } from "@/lib/api/errors";

export async function GET(req: Request) {
  const data = await fetchSomething();
  if (!data) return fail(ApiErrorCodes.not_found, "Lead não encontrado", 404);
  return ok(data, { meta: { cursor: nextCursor, has_more: true } });
}
```

## Idempotência

`idempotencia.ts` — reserva de execução para POST que produz efeito EXTERNO.
Guardada em **Postgres** (`idempotency_keys`), não em Upstash: Redis é opcional
no self-host, e uma idempotência que dependesse dele não existiria em metade das
instalações. Este arquivo esteve listado abaixo como "a adicionar, via Upstash"
por meses, e a promessa estava errada nas duas metades.

Reserva ANTES de executar, e não consulta-executa-grava: o efeito externo demora,
e a segunda requisição chega enquanto a primeira ainda está em voo. Em uso na
rota de envio de mensagens.

## A adicionar (próximas specs)

- `auth.ts` — extrai user / tenant da request (cookie OU bearer); valida MFA; retorna `AuthContext`
- `rate-limit.ts` — sliding window via Upstash; injeta headers `X-RateLimit-*`
- `pagination.ts` — encode/decode de cursor opaco base64 + HMAC
- `audit.ts` — fire-and-forget write em `api_audit_log`
- `cors.ts` — allowlist por tenant
