/**
 * Aplica o texto inbound aos follow-ups vivos do contato.
 * Independente do wake/cron: o Hobby não tem tick de 1 min.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { idsDoContatoEGemeos } from "@/lib/channels/contato-por-telefone";

import {
  aplicarRespostaInbound,
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

export async function aplicarTextoNosFollowups(
  admin: SupabaseClient,
  sinal: SinalDeInboundFollowup,
): Promise<void> {
  const texto = sinal.texto?.trim() ?? "";
  if (!texto) return;
  const contactIds = await idsDoContatoEGemeos(admin, sinal.organizationId, sinal.contactId);
  const { data, error } = await admin
    .from("followup_enrollments")
    .select("*")
    .eq("organization_id", sinal.organizationId)
    .in("contact_id", contactIds)
    .in("status", ["waiting_reply", "active"]);
  if (error) throw new Error(error.message);
  const deps = tickDepsDe(admin);
  for (const row of data ?? []) {
    await aplicarRespostaInbound(deps, row as EnrollmentRow, texto);
  }
}
