import { registerAction } from "@/lib/automation/actions";
import type { ActionCtx, ActionResultDetail } from "@/lib/automation/types";
import { renderTemplate } from "@/lib/automation/template";
import { ensureConversation } from "@/lib/automation/start-conversation";
import {
  AUTOMATED_SEND_SPACING_MS,
  checkDailyLimit,
  jitterMs,
  nextWindowStart,
  withinSendWindow,
} from "@/lib/automation/throttle";
import { sendMessageHandler } from "@/app/api/v1/messages/_handler";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Espaçamento entre envios automatizados DENTRO do mesmo tick do drain,
// por sessão (estado de módulo — suficiente p/ instância única do cron).
const _lastSendAt = new Map<string, number>();

async function postponeUntil(ctx: ActionCtx, config: Record<string, unknown>): Promise<string | null> {
  if (!withinSendWindow()) return nextWindowStart();
  const sessionId = typeof config.channel_session_id === "string" ? config.channel_session_id : null;
  if (!sessionId) return null; // config inválida falha no execute, não adia
  const daily = await checkDailyLimit(ctx.admin, ctx.organizationId, sessionId);
  return daily.allowed ? null : (daily.retry_at ?? null);
}

async function execute(ctx: ActionCtx, config: Record<string, unknown>): Promise<ActionResultDetail> {
  const sessionId = typeof config.channel_session_id === "string" ? config.channel_session_id : null;
  const template = typeof config.template === "string" ? config.template : null;
  if (!sessionId || !template) {
    return { type: "send_whatsapp_message", status: "failed", error: "missing_config" };
  }
  const contact = ctx.context.contact as
    | {
        id: string;
        is_blocked?: boolean;
        phone_number?: string | null;
        consent?: { marketing?: { granted_at?: string | null } | null } | null;
      }
    | undefined;
  if (!contact) return { type: "send_whatsapp_message", status: "skipped", detail: { reason: "no_contact" } };
  if (contact.is_blocked) return { type: "send_whatsapp_message", status: "skipped", detail: { reason: "contact_blocked" } };
  if (!contact.phone_number) return { type: "send_whatsapp_message", status: "skipped", detail: { reason: "no_phone" } };
  // Gate FIXO, não configurável — decisão do dono: ausência de consentimento e
  // recusa explícita são o MESMO estado no schema (`consent.marketing.granted_at`
  // null nos dois casos; não existe coluna separada de "recusou"), e as duas
  // bloqueiam TODO envio automático, sem exceção por regra/trigger. Não vive em
  // `conditions` declarativas de propósito: o motor de `conditions` trata campo
  // ausente + operador `neq` como sempre-verdadeiro (achado 2026-08-25), o que
  // deixaria passar exatamente o caso mais perigoso — sem consentimento — se
  // alguém configurasse a condição errada. Invariante de segurança fica em
  // código, não em configuração que um admin possa desligar sem querer.
  if (!contact.consent?.marketing?.granted_at) {
    return { type: "send_whatsapp_message", status: "skipped", detail: { reason: "no_consent" } };
  }

  const last = _lastSendAt.get(sessionId) ?? 0;
  const wait = last + AUTOMATED_SEND_SPACING_MS + jitterMs() - Date.now();
  if (wait > 0) await sleep(wait);
  _lastSendAt.set(sessionId, Date.now());

  try {
    const conversationId = await ensureConversation(ctx.admin, ctx.organizationId, contact.id, sessionId);
    const body = renderTemplate(template, ctx.context);
    const message = await sendMessageHandler(
      ctx.admin,
      {
        organization_id: ctx.organizationId,
        actor: { type: "webhook_source", id: ctx.ruleId },
        requestId: `rule:${ctx.ruleId}`,
      },
      { conversation_id: conversationId, type: "text", body } as Parameters<typeof sendMessageHandler>[2],
    );
    const meta = (message as { metadata?: Record<string, unknown> }).metadata ?? {};
    return {
      type: "send_whatsapp_message",
      status: "success",
      detail: {
        message_id: (message as { id: string }).id,
        conversation_id: conversationId,
        ...(meta.queued_reason ? { queued_reason: meta.queued_reason } : {}),
      },
    };
  } catch (err) {
    return {
      type: "send_whatsapp_message",
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

registerAction({ type: "send_whatsapp_message", postponeUntil, execute });
