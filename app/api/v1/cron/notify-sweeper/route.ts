/**
 * Fecha reserva de notificação que ficou presa — e é ele quem torna a falha
 * VISÍVEL.
 *
 * ⚠️ Por que este cron existe, e o que ele impede
 *
 * A ação `notify_number` grava a reserva ANTES de falar com o WhatsApp. Se o
 * processo morrer entre a reserva e o desfecho — deploy, OOM, queda do worker —
 * a linha fica `reserved` para sempre, e isso custa duas coisas:
 *
 * 1. **O aviso nunca chega, e ninguém sabe.** É o pior desfecho possível para
 *    este recurso: quem configurou a regra CONFIA que seria avisado, e a
 *    ausência de mensagem é indistinguível de "não aconteceu nada". O pedido
 *    original nasceu de "não vou ficar com a plataforma aberta 24h" — uma falha
 *    silenciosa devolve a pessoa exatamente para o problema que ela quis sair.
 *
 * 2. **A supressão do eco fica aberta naquele número.** A ingestão ignora o
 *    `fromMe` quando existe reserva EM VOO para o destinatário. Reserva presa é
 *    reserva em voo para sempre: mensagem legítima daquele número passaria a
 *    sumir do CRM em silêncio — o defeito #108 pela porta dos fundos.
 *
 * É o item 2 que torna este cron **obrigatório**, não conveniente: sem ele a
 * feature nova cria um modo de falha permanente noutro lugar do produto.
 *
 * ─── Não reenvia, e isso é decisão ─────────────────────────────────────────
 *
 * Mesmo argumento de `recover-stuck-messages`: reenviar exigiria saber POR QUE
 * não foi. Um aviso duplicado no celular do dono às 3h da manhã é pior que um
 * aviso perdido com registro na Central — e o executor já tenta duas vezes
 * antes de desistir.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Depois disto, uma reserva `reserved` é considerada órfã.
 *
 * 10 minutos é o mesmo prazo que o `event-log/drain` usa para devolver evento
 * preso à fila — se o evento já voltou e a reserva continua aberta, quem a
 * criou não existe mais.
 */
export const RESERVA_ORFA_APOS_MS = 10 * 60 * 1000;

interface Resultado {
  varridas: number;
  organizacoes: number;
}

async function varrer(requestId: string): Promise<Resultado> {
  const admin = createAdminClient();
  const limite = new Date(Date.now() - RESERVA_ORFA_APOS_MS).toISOString();

  const { data: presas, error } = await admin
    .from("org_notify_sends")
    .select("id, organization_id, notify_number_id, rule_id")
    .eq("status", "reserved")
    .lt("reserved_at", limite)
    .limit(200);
  if (error) throw new Error(error.message);
  if (!presas || presas.length === 0) return { varridas: 0, organizacoes: 0 };

  await admin
    .from("org_notify_sends")
    .update({ status: "failed" })
    .in(
      "id",
      presas.map((r) => r.id as string),
    );

  const porOrg = new Map<string, number>();
  for (const r of presas) {
    const org = r.organization_id as string;
    porOrg.set(org, (porOrg.get(org) ?? 0) + 1);
  }

  for (const [orgId, n] of porOrg) {
    // Um aviso por organização por rodada, não um por reserva: quando o worker
    // cai, o que falha não é um aviso, é o envio inteiro — N linhas idênticas
    // enterrariam a Central justamente no dia em que ela precisa ser lida.
    const { error: inboxErr } = await admin.from("agent_inbox_items").insert({
      organization_id: orgId,
      kind: "notificacao_nao_entregue",
      severity: "warn",
      title:
        n === 1
          ? "Um aviso automático não foi entregue"
          : `${n} avisos automáticos não foram entregues`,
      body:
        `A automação tentou avisar um número cadastrado e o envio não se completou. ` +
        `Verifique se a conexão do WhatsApp está ativa. ` +
        `Nada foi reenviado automaticamente — reenviar sem saber a causa arrisca ` +
        `mandar o mesmo aviso duas vezes, e ele pode chegar de madrugada.`,
      ref_kind: "automation_rule",
      ref_id: presas.find((r) => r.organization_id === orgId)?.rule_id ?? null,
    });
    if (inboxErr) {
      // O aviso é o que torna a falha visível; perdê-lo em silêncio recriaria
      // exatamente o defeito que este cron existe para consertar.
      logger.error("[notify-sweeper] aviso na Central falhou", {
        error: inboxErr.message,
        organization_id: orgId,
        requestId,
      });
    }
  }

  return { varridas: presas.length, organizacoes: porOrg.size };
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  const accepted = [env.INTERNAL_CRON_SECRET, env.INTERNAL_SECRET].filter(Boolean);
  if (accepted.length === 0 || !accepted.includes(provided)) {
    return fail("forbidden", "Cron secret missing or invalid.", 403, { requestId });
  }

  let result: Resultado;
  try {
    result = await varrer(requestId);
  } catch (err) {
    logger.error("[notify-sweeper] varredura falhou", {
      error: err instanceof Error ? err.message : String(err),
      requestId,
    });
    return fail("internal_error", "Failed to sweep notify reservations.", 500, { requestId });
  }

  // Rodada que não varreu nada não é mutação e não ocupa linha de auditoria —
  // 1×/5min numa instalação sem automação encheria o audit log de nada.
  if (result.varridas > 0) {
    void audit({
      action: "automation.notify_sweep_run",
      actorUserId: null,
      organizationId: null,
      resourceType: "org_notify_send",
      resourceId: null,
      requestId,
      metadata: { sweeper: true, varridas: result.varridas, organizacoes: result.organizacoes },
    });
  }

  return ok(result, { requestId });
}
