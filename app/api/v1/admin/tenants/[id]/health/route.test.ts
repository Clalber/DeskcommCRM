import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/v1/admin/tenants/[id]/health — o painel de saúde do tenant.
 *
 * O predicado de Nuvemshop comparava com `active`, valor que não existe em
 * `tenant_integrations_status_check` (connecting/healthy/token_expired/
 * scope_missing/disconnected/rate_limited/error). Quem escreve a linha
 * conectada é o callback do OAuth, com `healthy`: integração perfeita aparecia
 * como "Não conectado", e o ramo crítico de token vencido era inalcançável.
 */

vi.mock("@/lib/auth/requirePlatformAdmin", () => ({
  requirePlatformAdmin: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const ORG_ID = "22222222-2222-4222-8222-222222222222";

const DIA = 24 * 60 * 60 * 1000;

function thenable(value: unknown) {
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit"]) {
    builder[m] = () => builder;
  }
  builder.maybeSingle = async () => value;
  builder.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(value).then(resolve);
  return builder;
}

function makeAdminStub(nuvemshop: { status: string; expires_at: string | null } | null) {
  return {
    from: (table: string) => {
      if (table === "channel_sessions") return thenable({ data: [], error: null });
      if (table === "tenant_integrations") {
        return thenable({
          data: nuvemshop
            ? [
                {
                  id: "int-1",
                  status: nuvemshop.status,
                  expires_at: nuvemshop.expires_at,
                  last_sync_at: "2026-08-01T10:00:00Z",
                  updated_at: "2026-08-01T10:00:00Z",
                },
              ]
            : [],
          error: null,
        });
      }
      if (table === "ai_budgets") return thenable({ data: [], error: null });
      if (table === "api_audit_log") return thenable({ data: null, error: null });
      throw new Error(`unexpected table ${table}`);
    },
  };
}

async function chamar(
  nuvemshop: { status: string; expires_at: string | null } | null,
) {
  vi.mocked(createAdminClient).mockReturnValue(makeAdminStub(nuvemshop) as never);
  const { GET } = await import("./route");
  const res = await GET(
    new NextRequest(`http://localhost/api/v1/admin/tenants/${ORG_ID}/health`),
    { params: Promise.resolve({ id: ORG_ID }) },
  );
  const body = (await res.json()) as {
    data: { nuvemshop: { connected: boolean; status: string } };
  };
  return body.data.nuvemshop;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePlatformAdmin).mockResolvedValue({
    user: { id: ADMIN_ID },
    platformAdmin: { user_id: ADMIN_ID, scope: "full", mfa_required: true },
  } as never);
});

describe("GET /api/v1/admin/tenants/[id]/health — Nuvemshop", () => {
  it("`healthy` (o que o callback do OAuth grava) conta como conectado", async () => {
    const nu = await chamar({
      status: "healthy",
      expires_at: new Date(Date.now() + 90 * DIA).toISOString(),
    });
    expect(nu.connected).toBe(true);
    expect(nu.status).toBe("ok");
  });

  it("token vencido é crítico, não um genérico 'não conectado'", async () => {
    const nu = await chamar({
      status: "token_expired",
      expires_at: new Date(Date.now() - DIA).toISOString(),
    });
    expect(nu.status).toBe("critical");
  });

  it("`disconnected` e ausência de integração continuam como não conectado", async () => {
    const desligado = await chamar({ status: "disconnected", expires_at: null });
    expect(desligado.connected).toBe(false);
    expect(desligado.status).toBe("warning");

    const semLinha = await chamar(null);
    expect(semLinha.connected).toBe(false);
    expect(semLinha.status).toBe("warning");
  });
});
