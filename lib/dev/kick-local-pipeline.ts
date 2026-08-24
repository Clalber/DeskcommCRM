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

function deveAcionarPipelineInline(): boolean {
  return process.env.NODE_ENV === "development" || process.env.VERCEL === "1";
}

export async function kickLocalPipeline(admin: SupabaseClient): Promise<void> {
  if (!deveAcionarPipelineInline()) return;

  try {
    ensureHandlersRegistered();
    const drain = await drainEventLog(admin);
    logger.info("[dev.pipeline] event-log-drain", { ...drain });

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
    // Um nó por tick: o primeiro só sai do trigger (advanced=1, scheduled=0).
    // Sem loop a ação de envio nunca entra na job_queue neste POST.
    const ticks = [];
    for (let i = 0; i < 8; i++) {
      const tick = await runFollowupTick(tickDeps);
      ticks.push(tick);
      if (!tick.claimed) break;
    }
    logger.info("[dev.pipeline] followup-tick", { ticks });
  } catch (err) {
    logger.warn("[dev.pipeline] kick falhou (lead já foi criado)", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
