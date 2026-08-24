/**
 * Ação `start_message_flow` — inscreve o contato do contexto num follow-up
 * publicado. Reusa enrollFollowupFlow (mesmo caminho do POST de enrollments).
 * organization_id vem da regra, nunca do body.
 *
 * Enroll não emite event_log; requestId `rule:{id}` fica no audit se houver
 * actor humano. Conflito de inscrição viva (23505) falha de forma explícita.
 */
import { registerAction } from "@/lib/automation/actions";
import type { ActionCtx, ActionResultDetail } from "@/lib/automation/types";
import { enrollFollowupFlow } from "@/lib/followup/enroll";

const TYPE = "start_message_flow";

function contactIdFromCtx(ctx: ActionCtx): string | null {
  const contact = ctx.context.contact as { id?: string } | undefined;
  if (typeof contact?.id === "string" && contact.id) return contact.id;
  const lead = ctx.context.lead as { contact_id?: string | null } | undefined;
  if (typeof lead?.contact_id === "string" && lead.contact_id) return lead.contact_id;
  return null;
}

export async function executeStartMessageFlow(
  ctx: ActionCtx,
  config: Record<string, unknown>,
): Promise<ActionResultDetail> {
  const pointerId = typeof config.flow_pointer_id === "string" ? config.flow_pointer_id : null;
  if (!pointerId) {
    // #region agent log
    fetch("http://127.0.0.1:7701/ingest/87ca3154-89cc-4a8f-92e3-eaa13aed4946", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a1ee90" },
      body: JSON.stringify({
        sessionId: "a1ee90",
        hypothesisId: "D",
        location: "lib/automation/actions/start-message-flow.ts:missing-config",
        message: "missing flow_pointer_id",
        data: { configKeys: Object.keys(config) },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return { type: TYPE, status: "failed", error: "missing_config" };
  }

  const contactId = contactIdFromCtx(ctx);
  if (!contactId) {
    // #region agent log
    fetch("http://127.0.0.1:7701/ingest/87ca3154-89cc-4a8f-92e3-eaa13aed4946", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a1ee90" },
      body: JSON.stringify({
        sessionId: "a1ee90",
        hypothesisId: "D",
        location: "lib/automation/actions/start-message-flow.ts:no-contact",
        message: "no contact on context",
        data: { hasLead: Boolean(ctx.context.lead), hasContact: Boolean(ctx.context.contact) },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return { type: TYPE, status: "skipped", detail: { reason: "no_contact" } };
  }

  const result = await enrollFollowupFlow(ctx.admin, {
    organizationId: ctx.organizationId,
    pointerId,
    contactId,
    actorUserId: null,
    requestId: `rule:${ctx.ruleId}`,
  });

  if (!result.ok) {
    // #region agent log
    fetch("http://127.0.0.1:7701/ingest/87ca3154-89cc-4a8f-92e3-eaa13aed4946", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a1ee90" },
      body: JSON.stringify({
        sessionId: "a1ee90",
        hypothesisId: "D",
        location: "lib/automation/actions/start-message-flow.ts:enroll-fail",
        message: "enrollFollowupFlow failed",
        data: { code: result.code },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    if (result.code === "conflict") {
      return {
        type: TYPE,
        status: "failed",
        error: "live_enrollment_exists",
        detail: { reason: "live_enrollment_exists" },
      };
    }
    if (result.code === "flow_not_active") {
      return { type: TYPE, status: "skipped", detail: { reason: "flow_not_active" } };
    }
    return { type: TYPE, status: "failed", error: result.message, detail: { code: result.code } };
  }

  // #region agent log
  fetch("http://127.0.0.1:7701/ingest/87ca3154-89cc-4a8f-92e3-eaa13aed4946", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a1ee90" },
    body: JSON.stringify({
      sessionId: "a1ee90",
      hypothesisId: "D",
      location: "lib/automation/actions/start-message-flow.ts:success",
      message: "enrollment created",
      data: { enrollmentId: result.enrollment.id },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  return {
    type: TYPE,
    status: "success",
    detail: { enrollment_id: result.enrollment.id },
  };
}

registerAction({ type: TYPE, execute: executeStartMessageFlow });
