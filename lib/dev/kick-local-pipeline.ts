/**
 * Relógio local do pipeline webhook → automação → follow-up.
 *
 * Em produção o crontab da VPS chama `/api/v1/cron/event-log-drain` e
 * `followup-flow-worker`. `next dev` não tem crontab — sem isto o lead
 * nasce e o gatilho fica para sempre em `event_log.status=pending`.
 *
 * Corre em `next dev` e no deploy Vercel (`VERCEL=1`): o Hobby não agenda
 * event-log-drain/followup-flow-worker (só 1 cron/dia). Sem isto o lead nasce
 * e o gatilho fica em `event_log.status=pending`. Falha nunca vira 5xx.
 *
 * O envio WhatsApp ainda é o `agent-worker` (job_queue). Sem worker, o job
 * fica `pending`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { drainEventLog } from "@/lib/event-log/drain";
import { ensureHandlersRegistered } from "@/lib/event-log/register-handlers";
import {
  createSupabaseAdminClient,
  runFollowupTick,
  type FollowupJobRequest,
} from "@/lib/followup/engine";
import { logger } from "@/lib/logger";

async function tickFollowupAteParar(admin: SupabaseClient): Promise<void> {
  const enqueueJob = async (job: FollowupJobRequest): Promise<void> => {
    const { error } = await admin.from("job_queue").insert({
      organization_id: job.organization_id,
      contact_id: job.contact_id,
      kind: "followup_turn",
      payload: job.payload,
    });
    if (error) throw new Error(error.message);
  };
  const tickDeps = {
    db: createSupabaseAdminClient(admin),
    clock: () => new Date(),
    enqueueJob,
  };
  const ticks = [];
  for (let i = 0; i < 8; i++) {
    const tick = await runFollowupTick(tickDeps);
    ticks.push(tick);
    if (!tick.claimed) break;
  }
  logger.info("[dev.pipeline] followup-tick", { ticks });
}

/** Drena event_log e avança follow-up agora. Usado na ingestão inbound (resposta
 *  do lead) — não espera o cron de 1 min. Falha nunca derruba a ingestão. */
export async function acelerarPipelineDeEventos(admin: SupabaseClient): Promise<void> {
  try {
    ensureHandlersRegistered();
    const drain = await drainEventLog(admin);
    logger.info("[dev.pipeline] event-log-drain", { ...drain });
    await tickFollowupAteParar(admin);
  } catch (err) {
    logger.warn("[dev.pipeline] acelerar falhou (mensagem já gravada)", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function kickLocalPipeline(admin: SupabaseClient): Promise<void> {
  // Sempre: o webhook de captação em Vercel/Hobby não tem cron de 1 min.
  // Na VPS o crontab continua; drenar neste request só antecipa o mesmo trabalho.
  await acelerarPipelineDeEventos(admin);
}
