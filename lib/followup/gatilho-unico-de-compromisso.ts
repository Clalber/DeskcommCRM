/**
 * UM FLUXO ARMADO POR COMPROMISSO POR ORGANIZAÇÃO — a regra, num lugar só.
 *
 * ## Por que a regra existe
 *
 * A idempotência do lembrete é UMA coluna por compromisso
 * (`calendar_appointments.reminder_sent_at`, 0177), não uma por (compromisso,
 * fluxo). Com dois fluxos armados por compromisso na mesma conta, o de janela
 * MAIOR alcança o compromisso primeiro, marca a coluna, e o outro nunca mais o
 * enxerga — ele sai da consulta do sweep. Não vira `skipped_existing`, não vira
 * erro, não vira contador: o segundo fluxo fica `active` na tela e não dispara
 * uma vez sequer.
 *
 * ## ⚠️ POR QUE ELA NÃO PODE MORAR SÓ NO PUBLISH
 *
 * Nasceu no publish, e uma auditoria independente furou a barreira em um
 * minuto: `PATCH /api/v1/ai/followup-flows/:id` grava `trigger_config` sem olhar
 * `status`, e o painel do construtor salva por ali. Bastava ter um fluxo ATIVO
 * qualquer — um de silêncio, digamos —, abrir o seletor de gatilho, escolher
 * "Antes de um compromisso marcado" e Salvar: nenhum republish, nenhuma recusa,
 * e no tique seguinte a organização tinha dois pointers de compromisso. A
 * barreira do publish continuava lá, intacta e inútil, porque havia outra porta
 * para o mesmo estado.
 *
 * `loadActiveAppointmentPointers` lê `trigger_config` AO VIVO de todo pointer
 * `active` — ele não pergunta como aquele valor chegou lá. Enquanto for assim,
 * TODA porta que escreve `trigger_config` de um pointer ativo precisa passar por
 * aqui. Esta função existe para que a próxima porta tenha onde bater.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const KIND_DE_COMPROMISSO = "appointment_upcoming";

/** `null` = pode seguir. String = a recusa, já escrita para quem opera. */
export async function motivoParaRecusarSegundoLembrete(
  db: SupabaseClient,
  orgId: string,
  pointerId: string,
): Promise<string | null> {
  const { data, error } = await db
    .from("followup_flow_pointers")
    .select("id, name, trigger_config")
    .eq("organization_id", orgId)
    .eq("status", "active")
    .neq("id", pointerId);
  if (error) throw new Error(error.message);

  const jaArmado = (data ?? []).find(
    (p) => ((p.trigger_config ?? {}) as { kind?: string }).kind === KIND_DE_COMPROMISSO,
  );
  if (!jaArmado) return null;

  return (
    `O fluxo «${String(jaArmado.name)}» já está armado por compromisso, e só um pode estar. ` +
    `Dois fluxos de lembrete se anulam: o de janela maior marca o compromisso primeiro e o outro ` +
    `nunca dispara. Desative aquele antes de armar este.`
  );
}

/** O `kind` que este `trigger_config` declara, tolerando jsonb de qualquer forma. */
export function kindDoTrigger(triggerConfig: unknown): string {
  const cfg = (triggerConfig ?? {}) as { kind?: unknown };
  return typeof cfg.kind === "string" ? cfg.kind : "manual";
}
