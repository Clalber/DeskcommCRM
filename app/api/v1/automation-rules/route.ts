/**
 * GET  /api/v1/automation-rules — lista as regras de automação da org ativa.
 * POST /api/v1/automation-rules — cria uma regra. is_active NUNCA aceito no
 *   create (schema não tem o campo) — regra nasce pausada (default FALSE do banco).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import {
  chaveDoCabecalho,
  guardarResultado,
  hashDoPedido,
  reservarExecucao,
  soltarReserva,
} from "@/lib/api/idempotencia";
import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { createAutomationRuleSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptRuleActionSecrets } from "@/lib/webhooks/secrets";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "automation_rules" });
  if (!authz.ok) return authz.response;
  const { org: activeOrg } = authz;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("automation_rules")
    .select("*")
    .eq("organization_id", activeOrg.orgId)
    .order("created_at", { ascending: false });
  if (error) return fail("internal_error", error.message, 500, { requestId });
  return ok(data ?? [], { requestId });
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "automation_rules" });
  if (!authz.ok) return authz.response;
  const { user, org: activeOrg } = authz;

  let raw: unknown = {};
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  const parsed = createAutomationRuleSchema.safeParse(raw);
  if (!parsed.success) {
    return fail("invalid_request", "Dados inválidos.", 400, {
      requestId,
      details: parsed.error.flatten(),
    });
  }

  // Secrets de call_webhook nunca ficam em claro no jsonb (migration 0041).
  const safeActions = await encryptRuleActionSecrets(createAdminClient(), parsed.data.actions);
  if (safeActions === null) {
    return fail(
      "encryption_unavailable",
      "Não foi possível guardar o segredo do webhook com segurança: a chave de cifra desta instalação não está ativa. Quem administra o servidor resolve rodando o update.sh, que gera e ativa a chave. Enquanto isso, você pode criar a ação sem segredo.",
      422,
      { requestId },
    );
  }

  // ─── A RESERVA, antes de inserir ─────────────────────────────────────────
  //
  // ⚠️ Sem isto, uma regra vira DUAS — e o defeito é do cliente fazendo a coisa
  // certa. `lib/api/client.ts` retenta mutação quando a rede falha, reenviando
  // a MESMA `Idempotency-Key`; se a primeira requisição chegou ao banco e a
  // resposta se perdeu no caminho, a retentativa cria uma cópia idêntica.
  //
  // Medido em produção nesta instalação, com dois `request_id` distintos e as
  // duas linhas auditadas: 06:23:25.271 e 06:23:25.629 — 358ms de intervalo, o
  // exato `backoffMs(1)` (200ms ± 50 de jitter) mais o tempo do primeiro POST.
  // O gatilho foi a instabilidade de rede da VPS, mas a causa é esta rota
  // ignorar o cabeçalho: a doutrina diz que quem falha é sempre a ROTA.
  //
  // `hashDoPedido` entra no escopo de propósito: chave repetida com corpo
  // DIFERENTE é erro de quem chama, não repetição — e devolver a primeira regra
  // ali esconderia a segunda que a pessoa quis criar.
  const escopo = {
    organizationId: activeOrg.orgId,
    chave: chaveDoCabecalho(req.headers),
    endpoint: "/api/v1/automation-rules",
    requestHash: hashDoPedido(parsed.data),
  };
  const admin = createAdminClient();
  const reserva = await reservarExecucao(admin, escopo);

  if (reserva.estado === "repetida") {
    // A MESMA regra que a primeira tentativa criou. Devolver erro aqui faria a
    // pessoa ver falha numa regra que existe — e criar de novo à mão, trazendo
    // a duplicata de volta pela porta da frente.
    return ok(reserva.corpo, { status: 200, requestId });
  }

  if (reserva.estado === "em_andamento") {
    return fail(
      "idempotency_conflict",
      "Esta automação já está sendo criada. Aguarde um instante e recarregue a lista.",
      409,
      { requestId },
    );
  }

  const supabase = await createClient();
  const { data: created, error: insErr } = await supabase
    .from("automation_rules")
    .insert({
      organization_id: activeOrg.orgId,
      created_by_user_id: user.id,
      name: parsed.data.name,
      trigger_event: parsed.data.trigger_event,
      conditions: parsed.data.conditions,
      actions: safeActions,
    })
    .select("*")
    .single();
  if (insErr || !created) {
    // Falha SOLTA a reserva: guardar o erro faria uma indisponibilidade curta
    // virar erro permanente por 24 horas para esta chave, e a retentativa — que
    // é o que salvaria a criação — encontraria uma reserva morta.
    await soltarReserva(admin, escopo);
    return fail("internal_error", insErr?.message ?? "automation_rule_insert_failed", 500, { requestId });
  }

  await guardarResultado(admin, escopo, {
    status: 201,
    corpo: created as unknown as Record<string, unknown>,
  });

  void audit({
    action: "automation.rule_created",
    actorUserId: user.id,
    organizationId: activeOrg.orgId,
    resourceType: "automation_rule",
    resourceId: created.id,
    requestId,
    metadata: { name: parsed.data.name, trigger_event: parsed.data.trigger_event },
  });

  return ok(created, { requestId, status: 201 });
}
