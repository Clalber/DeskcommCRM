/**
 * Relógio local do pipeline webhook → automação → follow-up.
 *
 * Em produção o crontab da VPS chama `/api/v1/cron/event-log-drain` e
 * `followup-flow-worker`. `next dev` não tem crontab — sem isto o lead
 * nasce e o gatilho fica para sempre em `event_log.status=pending`.
 *
 * Só corre com NODE_ENV=development. Falha nunca vira 5xx do webhook.
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

export async function kickLocalPipeline(admin: SupabaseClient): Promise<void> {
  // #region agent log
  fetch("http://127.0.0.1:7701/ingest/87ca3154-89cc-4a8f-92e3-eaa13aed4946", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a1ee90" },
    body: JSON.stringify({
      sessionId: "a1ee90",
      hypothesisId: "A",
      location: "lib/dev/kick-local-pipeline.ts:entry",
      message: "kickLocalPipeline entry",
      data: { nodeEnv: process.env.NODE_ENV ?? null },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  if (process.env.NODE_ENV !== "development") return;

  try {
    ensureHandlersRegistered();
    const drain = await drainEventLog(admin);
    logger.info("[dev.pipeline] event-log-drain", drain);
    // #region agent log
    fetch("http://127.0.0.1:7701/ingest/87ca3154-89cc-4a8f-92e3-eaa13aed4946", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a1ee90" },
      body: JSON.stringify({
        sessionId: "a1ee90",
        hypothesisId: "B",
        location: "lib/dev/kick-local-pipeline.ts:after-drain",
        message: "drainEventLog result",
        data: drain,
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

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
    // #region agent log
    fetch("http://127.0.0.1:7701/ingest/87ca3154-89cc-4a8f-92e3-eaa13aed4946", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a1ee90" },
      body: JSON.stringify({
        sessionId: "a1ee90",
        hypothesisId: "E",
        runId: "post-fix",
        location: "lib/dev/kick-local-pipeline.ts:after-tick",
        message: "runFollowupTick loop result",
        data: { ticks },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  } catch (err) {
    logger.warn("[dev.pipeline] kick falhou (lead já foi criado)", {
      error: err instanceof Error ? err.message : String(err),
    });
    // #region agent log
    fetch("http://127.0.0.1:7701/ingest/87ca3154-89cc-4a8f-92e3-eaa13aed4946", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a1ee90" },
      body: JSON.stringify({
        sessionId: "a1ee90",
        hypothesisId: "A",
        location: "lib/dev/kick-local-pipeline.ts:catch",
        message: "kickLocalPipeline threw",
        data: { error: err instanceof Error ? err.message : String(err) },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }
}
