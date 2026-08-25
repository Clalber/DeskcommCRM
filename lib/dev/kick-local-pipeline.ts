/**
 * Relógio do pipeline webhook → automação → follow-up → 1º envio.
 *
 * NÃO usa cron da Vercel. O Hobby só agenda 1×/dia e event-log-drain nem
 * entra na lista. Este código corre DENTRO do POST (captação ou inbound).
 *
 * O crontab da VPS continua existindo como rede de segurança; não é requisito
 * desta jornada. Falha aqui nunca vira 5xx do webhook.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { sendMessageHandler } from "@/app/api/v1/messages/_handler";
import { ApiError } from "@/lib/api/types";
import { ensureConversation, sessaoProntaParaEnvio } from "@/lib/automation/start-conversation";
import { drainEventLog } from "@/lib/event-log/drain";
import { ensureHandlersRegistered } from "@/lib/event-log/register-handlers";
import { idsDoContatoEGemeos } from "@/lib/channels/contato-por-telefone";
import { aplicarTextoNosFollowups } from "@/lib/followup/aplicar-inbound";
import {
  avancarEnrollmentAtivo,
  createSupabaseAdminClient,
  type FollowupJobRequest,
  type TickDeps,
} from "@/lib/followup/engine";
import type { EnrollmentRow } from "@/lib/followup/node-handlers";
import { applyReactivityEvent, createSupabaseReactivityClient } from "@/lib/followup/reactivity";
import { completeTurnForEnrollment, type TurnBridgeAdminClient } from "@/lib/followup/turn-bridge";
import { logger } from "@/lib/logger";

export type SinalDeInbound = {
  organizationId: string;
  contactId: string;
  messageId?: string | null;
  texto?: string | null;
};

export type ContatoDoPipeline = {
  organizationId: string;
  contactId: string;
};

function tickDepsDe(admin: SupabaseClient): TickDeps {
  return {
    db: createSupabaseAdminClient(admin),
    clock: () => new Date(),
    enqueueJob: async (job) => {
      const { error } = await admin.from("job_queue").insert({
        organization_id: job.organization_id,
        contact_id: job.contact_id,
        kind: "followup_turn",
        payload: job.payload,
      });
      if (error) throw new Error(error.message);
    },
  };
}

/**
 * Arranca só o fluxo DESTE contato, e só nós `active`.
 * `waiting_reply` avança com a mensagem do WhatsApp (`aplicarTextoNosFollowups`),
 * não com um POST de captação — o claim global tratava a espera vencida como
 * timeout no mesmo request do webhook de contato.
 */
async function tickAtivosDoContato(
  admin: SupabaseClient,
  contato: ContatoDoPipeline,
): Promise<number> {
  const ids = await idsDoContatoEGemeos(admin, contato.organizationId, contato.contactId);
  const agora = new Date().toISOString();
  const { data, error } = await admin
    .from("followup_enrollments")
    .select("*")
    .eq("organization_id", contato.organizationId)
    .in("contact_id", ids)
    .eq("status", "active")
    .lte("next_eval_at", agora)
    .limit(8);
  if (error) throw new Error(error.message);
  const deps = tickDepsDe(admin);
  for (const row of data ?? []) {
    await avancarEnrollmentAtivo(deps, row as EnrollmentRow);
  }
  return data?.length ?? 0;
}

function ponteSupabase(admin: SupabaseClient): TurnBridgeAdminClient {
  const base = createSupabaseAdminClient(admin);
  return {
    ...base,
    async loadEnrollmentById(orgId, id) {
      const { data, error } = await admin
        .from("followup_enrollments")
        .select("*")
        .eq("id", id)
        .eq("organization_id", orgId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return data as EnrollmentRow;
    },
  };
}

/** Envia o texto fixo do fluxo neste request — sem cron e sem agent-worker. */
async function enviarTextoFixoPendente(
  admin: SupabaseClient,
  somenteContactIds?: string[],
): Promise<number> {
  const { data: jobs, error } = await admin
    .from("job_queue")
    .select("id, organization_id, contact_id, payload")
    .eq("kind", "followup_turn")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(5);
  if (error) throw new Error(error.message);

  let enviados = 0;
  const ponte = ponteSupabase(admin);
  for (const job of jobs ?? []) {
    const payload = (job.payload ?? {}) as FollowupJobRequest["payload"];
    const body = payload.fixed_body;
    const enrollmentId = payload.followup_enrollment_id;
    const nodeId = payload.node_id;
    const contactId = job.contact_id as string | null;
    if (typeof body !== "string" || !body || !enrollmentId || !nodeId || !contactId) continue;
    if (somenteContactIds && !somenteContactIds.includes(contactId)) continue;

    const { data: claimed, error: claimErr } = await admin
      .from("job_queue")
      .update({ status: "running" })
      .eq("id", job.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (claimErr) throw new Error(claimErr.message);
    if (!claimed) continue;

    try {
      const { data: enr } = await admin
        .from("followup_enrollments")
        .select("current_node_id")
        .eq("id", enrollmentId)
        .eq("organization_id", job.organization_id as string)
        .maybeSingle();
      if (!enr || enr.current_node_id !== nodeId) {
        await admin.from("job_queue").update({ status: "done" }).eq("id", job.id);
        continue;
      }
      const sessionId = await sessaoProntaParaEnvio(admin, job.organization_id as string);
      if (!sessionId) {
        logger.warn("[dev.pipeline] sem sessão de canal — job volta pra pending");
        await admin.from("job_queue").update({ status: "pending" }).eq("id", job.id);
        continue;
      }
      const conversationId = await ensureConversation(
        admin,
        job.organization_id as string,
        contactId,
        sessionId,
      );
      await sendMessageHandler(
        admin,
        {
          organization_id: job.organization_id as string,
          actor: { type: "webhook_source", id: enrollmentId },
          requestId: `followup:${job.id}`,
        },
        { conversation_id: conversationId, type: "text", body },
      );
      enviados++;
      try {
        await completeTurnForEnrollment(ponte, job.organization_id as string, enrollmentId, nodeId, {
          kind: "sent",
        });
      } catch (err) {
        logger.warn("[dev.pipeline] completeTurn apos envio", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
      const { error: doneErr } = await admin.from("job_queue").update({ status: "done" }).eq("id", job.id);
      if (doneErr) throw new Error(doneErr.message);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err);
      logger.warn("[dev.pipeline] envio inline falhou", { error: message });
      await admin
        .from("job_queue")
        .update({ status: "pending", last_error: message.slice(0, 300) })
        .eq("id", job.id);
    }
  }
  return enviados;
}

async function acordarFollowupPorInbound(admin: SupabaseClient, sinal: SinalDeInbound): Promise<void> {
  const db = createSupabaseReactivityClient(admin);
  await applyReactivityEvent(db, () => new Date(), {
    id: sinal.messageId ?? `inbound:${sinal.contactId}`,
    organization_id: sinal.organizationId,
    event_type: "message.received",
    entity_kind: "message",
    entity_id: sinal.messageId ?? null,
    payload: { contact_id: sinal.contactId },
    metadata: { source: "kick-local-pipeline" },
    consumed_by: [],
    attempts: 0,
  });
}

async function acelerarDesteContato(admin: SupabaseClient, contato: ContatoDoPipeline): Promise<void> {
  const ids = await idsDoContatoEGemeos(admin, contato.organizationId, contato.contactId);
  for (let i = 0; i < 6; i++) {
    const claimed = await tickAtivosDoContato(admin, contato);
    const enviados = await enviarTextoFixoPendente(admin, ids);
    if (!claimed && !enviados) break;
  }
}

export async function acelerarPipelineDeEventos(
  admin: SupabaseClient,
  inbound?: SinalDeInbound,
): Promise<void> {
  try {
    if (inbound) {
      try {
        await aplicarTextoNosFollowups(admin, inbound);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        logger.warn("[dev.pipeline] aplicar texto do inbound falhou", { error: detail });
      }
      try {
        await acordarFollowupPorInbound(admin, inbound);
      } catch (err) {
        logger.warn("[dev.pipeline] acordar follow-up falhou", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
      await acelerarDesteContato(admin, {
        organizationId: inbound.organizationId,
        contactId: inbound.contactId,
      });
    }
    ensureHandlersRegistered();
    try {
      const drain = await drainEventLog(admin);
      logger.info("[dev.pipeline] event-log-drain", { ...drain });
    } catch (err) {
      logger.warn("[dev.pipeline] drain falhou; tick do follow-up segue", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    if (inbound) {
      await acelerarDesteContato(admin, {
        organizationId: inbound.organizationId,
        contactId: inbound.contactId,
      });
    }
  } catch (err) {
    logger.warn("[dev.pipeline] acelerar falhou (lead/mensagem já gravados)", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function kickLocalPipeline(
  admin: SupabaseClient,
  contato?: ContatoDoPipeline,
): Promise<void> {
  await acelerarPipelineDeEventos(admin);
  if (contato) await acelerarDesteContato(admin, contato);
}
