/**
 * GET /api/v1/metrics/atrito — o Índice de Atrito (spec 16; doutrina
 * `docs/doctrine/sistema-vivo/03-medida-do-proposito.md`).
 *
 * Mede o PROPÓSITO declarado ("menor atrito possível para os dois lados"), que
 * até aqui não tinha número nenhum: `/metrics/attendants` devolve won, lost,
 * conversas e 1ª resposta — atividade e conversão.
 *
 * Escopo = a PRÓPRIA RLS, igual à rota irmã: `fn_atrito_metrics` é SECURITY
 * INVOKER e roda com o client user-scoped (cookie session), então as seis
 * tabelas lidas já filtram por `fn_user_org_ids()`. A org vem do cookie
 * validado, NUNCA do body/query. Read-only ⇒ sem audit.
 *
 * Piso de rota = `agent`, mesmo de `/metrics/attendants`: quem opera precisa
 * enxergar o custo do que opera. Sem filtro por atendente — atrito é
 * propriedade do sistema, não performance individual, e quebrá-lo por pessoa
 * convidaria exatamente o uso que a doutrina §3.6 desaconselha (otimização
 * local que degrada o todo).
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { montarPares, type AtritoRaw } from "@/lib/metrics/atrito";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const querySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

/**
 * Shape vazio para org sem dado no período. Os campos que dependem de
 * denominador nascem `null`, nunca `0` — a tela mostra "—". Devolver zero aqui
 * seria afirmar "nenhum atrito" onde o certo é "não medido" (doutrina §3.4).
 */
const VAZIO: Omit<AtritoRaw, "escopo"> = {
  cliente: {
    turnos_p50: null,
    turnos_p90: null,
    insistencia_media: null,
    insistencia_max: null,
    pedidos_de_humano: 0,
    descadastros: 0,
  },
  empresa: {
    intervencoes_por_demanda: null,
    espera_humana_p50_s: null,
    espera_humana_p90_s: null,
    retrabalho: 0,
    vetos: 0,
    execucoes_medidas: 0,
    envios_por_ia: 0,
    envios_humano_no_sistema: 0,
    envios_humano_fora: 0,
  },
  eficiencia: { ganhos: 0, perdidos: 0 },
};

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();

  const authz = await requireRole("agent", { requestId, resource: "metrics" });
  if (!authz.ok) return authz.response;
  const { org: activeOrg } = authz;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  if (!parsed.success) {
    return fail("validation_failed", "Query inválida.", 422, {
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
      requestId,
    });
  }

  const to = parsed.data.to ? new Date(parsed.data.to) : new Date();
  const from = parsed.data.from
    ? new Date(parsed.data.from)
    : new Date(to.getTime() - THIRTY_DAYS_MS);
  if (from.getTime() >= to.getTime()) {
    return fail("validation_failed", "Janela inválida: 'from' deve ser anterior a 'to'.", 422, {
      requestId,
    });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_atrito_metrics", {
    p_org: activeOrg.orgId,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  if (error) return fail("internal_error", error.message, 500, { requestId });

  const raw = (data ?? {
    ...VAZIO,
    escopo: { demandas: 0, de: from.toISOString(), ate: to.toISOString() },
  }) as unknown as AtritoRaw;

  return ok(
    {
      window: { from: from.toISOString(), to: to.toISOString() },
      escopo: raw.escopo,
      pares: montarPares(raw),
      // Os componentes crus viajam junto: a doutrina §3.4 regra 2 proíbe
      // agregado sem detalhamento, e é daqui que o drill-down sai.
      componentes: { cliente: raw.cliente, empresa: raw.empresa },
    },
    { requestId },
  );
}
