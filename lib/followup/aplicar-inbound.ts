/**
 * Aplica o texto inbound aos follow-ups vivos do contato e manda o
 * próximo passo neste mesmo request. O gatilho é a resposta do lead,
 * não o relógio.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { idsDoContatoEGemeos } from "@/lib/channels/contato-por-telefone";

import { enviarTextoFixoPendente } from "./enviar-texto-fixo";
import {
  aplicarRespostaInbound,
  avancarEnrollmentAtivo,
  createSupabaseAdminClient,
  type TickDeps,
} from "./engine";
import type { EnrollmentRow } from "./node-handlers";

export type SinalDeInboundFollowup = {
  organizationId: string;
  contactId: string;
  texto?: string | null;
};

export function textoDoPayloadInbound(payload: Record<string, unknown> | null | undefined): string {
  const preview = payload?.body_preview;
  if (typeof preview === "string" && preview.trim()) return preview.trim();
  const body = payload?.body;
  if (typeof body === "string" && body.trim()) return body.trim();
  return "";
}

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
 * Uma mensagem do lead vale para UM `match_reply`. Reaplicar o mesmo texto
 * no passo seguinte (endereço, motivo…) pula a pergunta.
 */
export function inboundEhDestaPergunta(enviadaEm: string, esperaDesde: string): boolean {
  return enviadaEm >= esperaDesde;
}

async function ultimoInboundDoContato(
  admin: SupabaseClient,
  orgId: string,
  contactIds: string[],
): Promise<string> {
  const { data, error } = await admin
    .from("messages")
    .select("body")
    .eq("organization_id", orgId)
    .in("contact_id", contactIds)
    .eq("direction", "inbound")
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return typeof data?.body === "string" ? data.body.trim() : "";
}

async function aplicarTextoAosEnrollmentsEmEspera(
  admin: SupabaseClient,
  orgId: string,
  contactIds: string[],
  texto: string,
  deps: TickDeps,
): Promise<void> {
  const { data, error } = await admin
    .from("followup_enrollments")
    .select("*")
    .eq("organization_id", orgId)
    .in("contact_id", contactIds)
    .eq("status", "waiting_reply");
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    await aplicarRespostaInbound(deps, row as EnrollmentRow, texto);
  }
}

export async function aplicarTextoNosFollowups(
  admin: SupabaseClient,
  sinal: SinalDeInboundFollowup,
): Promise<void> {
  const contactIds = await idsDoContatoEGemeos(admin, sinal.organizationId, sinal.contactId);
  const texto = (sinal.texto?.trim() || (await ultimoInboundDoContato(admin, sinal.organizationId, contactIds))).trim();
  if (!texto) return;
  const deps = tickDepsDe(admin);
  // 1ª passada: resposta chegou com o enrollment já em waiting_reply.
  await aplicarTextoAosEnrollmentsEmEspera(admin, sinal.organizationId, contactIds, texto, deps);
  for (let i = 0; i < 6; i++) {
    const agora = new Date().toISOString();
    const { data: vivos, error: vivosErr } = await admin
      .from("followup_enrollments")
      .select("*")
      .eq("organization_id", sinal.organizationId)
      .in("contact_id", contactIds)
      .eq("status", "active")
      .lte("next_eval_at", agora)
      .limit(8);
    if (vivosErr) throw new Error(vivosErr.message);
    for (const row of vivos ?? []) {
      await avancarEnrollmentAtivo(deps, row as EnrollmentRow);
    }
    const enviados = await enviarTextoFixoPendente(admin, contactIds);
    if (!(vivos?.length) && !enviados) break;
  }
  // 2ª passada: o SIM pode ter chegado enquanto o nó ainda era `active` (ex.:
  // cap_nome enfileirando a pergunta de confirmação neste mesmo request).
  await aplicarTextoAosEnrollmentsEmEspera(admin, sinal.organizationId, contactIds, texto, deps);
}
