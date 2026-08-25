/**
 * POST /api/v1/system/relogio/tick — uma batida do relógio.
 *
 * Auth: sessão admin OU Bearer INTERNAL_SECRET (GitHub Actions / cron externo).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { env } from "@/lib/env";
import { executarTickDoRelogio } from "@/lib/relogio/executar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function bearerValido(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  const provided = bearer || (req.headers.get("x-cron-secret")?.trim() ?? "");
  const accepted = [env.INTERNAL_CRON_SECRET, env.INTERNAL_SECRET].filter(Boolean);
  return accepted.length > 0 && Boolean(provided) && accepted.includes(provided);
}

async function sessaoAdmin(): Promise<boolean> {
  const user = await loadAuthUser();
  if (!user) return false;
  if (user.is_platform_admin) return true;
  const org = await resolveActiveOrg(user);
  return Boolean(org && ROLE_RANK[org.role] >= ROLE_RANK.admin);
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const porSegredo = bearerValido(req);
  if (!porSegredo && !(await sessaoAdmin())) {
    return fail("forbidden", "Cron secret missing or invalid.", 403, { requestId });
  }

  try {
    const resultado = await executarTickDoRelogio();
    if (resultado.mexeu) {
      const user = porSegredo ? null : await loadAuthUser();
      void audit({
        action: "relogio.tick_run",
        actorUserId: user?.id,
        organizationId: null,
        bypassedRls: true,
        requestId,
        metadata: { tarefas: resultado.tarefas.map((t) => ({ id: t.id, ok: t.ok })) },
      });
    }
    return ok(resultado, { requestId });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return fail("internal_error", detail, 500, { requestId });
  }
}

/** Alguns crons externos só sabem GET. Mesmo trabalho do POST. */
export async function GET(req: NextRequest): Promise<Response> {
  return POST(req);
}
