/**
 * Descadastrar um número de aviso.
 *
 * ⚠️ Remover o número NÃO desliga as regras que apontam para ele. A ação passa a
 * recusar com `numero_nao_registrado` — que é o comportamento certo (nada é
 * enviado para número fora da lista), mas silencioso. Por isso a resposta diz
 * quantas regras ficaram órfãs: quem removeu precisa saber que um aviso deixou
 * de existir, e não descobrir isso no dia em que precisar dele.
 */
import { randomUUID } from "node:crypto";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "org_notify_numbers" });
  if (!authz.ok) return authz.response;

  const { id } = await ctx.params;
  const supabase = await createClient();

  const { data: numero } = await supabase
    .from("org_notify_numbers")
    .select("id, label")
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();
  if (!numero) return fail("not_found", "Número não encontrado.", 404, { requestId });

  // Quantas regras ficam sem destino. Consulta o JSON das ações porque não há
  // FK de regra para número: a ação guarda o id dentro do `config`.
  const { data: regras } = await supabase
    .from("automation_rules")
    .select("id, name, actions")
    .eq("organization_id", authz.org.orgId);
  const orfas = (regras ?? []).filter((r) =>
    JSON.stringify(r.actions ?? []).includes(id),
  );

  const { error } = await supabase
    .from("org_notify_numbers")
    .delete()
    .eq("id", id)
    .eq("organization_id", authz.org.orgId);
  if (error) return fail("internal_error", "Falha ao remover o número.", 500, { requestId });

  await audit({
    action: "automation.notify_number_deleted",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "org_notify_number",
    resourceId: id,
    requestId,
    // O rótulo, nunca o telefone.
    metadata: { label: numero.label, regras_orfas: orfas.length },
  });

  return ok(
    { removido: id, regras_orfas: orfas.map((r) => ({ id: r.id, nome: r.name })) },
    { requestId },
  );
}
