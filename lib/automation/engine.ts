/**
 * Motor de regras: consome eventos-gatilho do event_log e executa as
 * automation_rules ativas do tenant. Registrado no registry via engine.handler.
 *
 * Anti-loop: eventos com metadata.caused_by_rule OU metadata.request_id
 * prefixado "rule:" não reprocessam (profundidade 1 no v1 — cadeia
 * regra→regra fica pra v2/Task 9, que estampa esse metadata nos eventos que
 * uma ação do motor emite).
 *
 * entity_kind guard: o trigger legado `fn_emit_event_on_lead_change` emite
 * lead.created/lead.stage_changed com entity_kind='lead' (derivado por
 * split_part do event_type), enquanto os handlers desta feature emitem com
 * entity_kind='crm_lead'. Sem este filtro o motor rodaria a regra 2x por
 * mudança de lead (uma vez por linha de event_log duplicada).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventRow, HandlerResult } from "@/lib/event-log/dispatcher";
import { evaluateConditions, type RuleCondition } from "@/lib/automation/conditions";
import { getAction } from "@/lib/automation/actions";
import type { ActionResultDetail } from "@/lib/automation/types";
import { audit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { partesNoFuso } from "@/lib/agenda/fuso";
import { rotuloLocal } from "@/lib/tempo/agora";
import { fusoValido, FUSO_PADRAO } from "@/lib/tempo/fusos";

export const AUTOMATION_CONSUMER_KEY = "automation-rules";

const EXPECTED_ENTITY_KIND: Record<string, string> = {
  "lead.created": "crm_lead",
  "lead.stage_changed": "crm_lead",
  "lead.tag_added": "crm_lead",
  "contact.tag_added": "contact",
  "message.received": "message",
};

interface RuleRow {
  id: string;
  name: string;
  conditions: RuleCondition[];
  actions: Array<{ type: string; config?: Record<string, unknown> }>;
}

async function resolveUserName(
  admin: SupabaseClient,
  userId: string,
  cache: Map<string, string | null>,
): Promise<string | null> {
  if (cache.has(userId)) {
    return cache.get(userId) ?? null;
  }
  try {
    const { data: userRes } = await admin.auth.admin.getUserById(userId);
    const fullName = (userRes?.user?.user_metadata?.full_name as string | undefined) ?? null;
    cache.set(userId, fullName);
    return fullName;
  } catch {
    cache.set(userId, null);
    return null;
  }
}

/**
 * Enriquece o contexto do lead com dados relacionais legiveis:
 * etapa, funil, responsavel, agendamento proximo e qualificacao de IA.
 */
export async function enrichLeadContext(
  admin: SupabaseClient,
  org: string,
  lead: Record<string, unknown>,
  context: Record<string, unknown>,
): Promise<void> {
  const userNameCache = new Map<string, string | null>();
  const customFields = (lead.custom_fields as Record<string, unknown> | null) ?? {};
  context.campo = customFields;
  context.custom_fields = customFields;

  // Etapa legivel
  if (typeof lead.stage_id === "string") {
    const { data: stage, error: stageErr } = await admin
      .from("crm_stages")
      .select("id, name, slug")
      .eq("id", lead.stage_id)
      .eq("organization_id", org)
      .maybeSingle();
    if (stageErr) {
      throw new Error(`[automation.engine] erro ao buscar crm_stages: ${stageErr.message}`);
    }
    if (stage) {
      context.stage = stage;
    }
  }

  // Funil legivel
  if (typeof lead.pipeline_id === "string") {
    const { data: pipeline, error: pipeErr } = await admin
      .from("crm_pipelines")
      .select("id, name")
      .eq("id", lead.pipeline_id)
      .eq("organization_id", org)
      .maybeSingle();
    if (pipeErr) {
      throw new Error(`[automation.engine] erro ao buscar crm_pipelines: ${pipeErr.message}`);
    }
    if (pipeline) {
      context.pipeline = pipeline;
    }
  }

  // Responsavel / Dono do lead
  if (typeof lead.owner_user_id === "string") {
    const fullName = await resolveUserName(admin, lead.owner_user_id, userNameCache);
    context.owner = { id: lead.owner_user_id, name: fullName ?? "Atendente" };
  } else if (typeof lead.owner_agent_id === "string") {
    const { data: agent, error: agentErr } = await admin
      .from("ai_agents")
      .select("id, name")
      .eq("id", lead.owner_agent_id)
      .eq("organization_id", org)
      .maybeSingle();
    if (agentErr) {
      throw new Error(`[automation.engine] erro ao buscar ai_agents: ${agentErr.message}`);
    }
    if (agent) {
      context.owner = { id: agent.id, name: agent.name };
    }
  }

  // --- Agendamento: consulta canonica com fallback (Migration 0177) --------
  // 1. Coleta vinculos de agendamento por crm_lead_links (target_kind = 'appointment')
  // 2. Procura agendamento futuro valido (starts_at >= now() - 10 min, status pending/confirmed)
  // 3. Fallback: se nenhum agendamento valido vinculado, busca pelo contato do lead
  // 4. Sempre ordenado ASC (a proxima reuniao)
  const leadId = typeof lead.id === "string" ? lead.id : null;
  const contactId = typeof lead.contact_id === "string" ? lead.contact_id : null;
  const agoraRecente = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  let linkApptIds: string[] = [];
  if (leadId) {
    const { data: links, error: linkErr } = await admin
      .from("crm_lead_links")
      .select("target_id")
      .eq("organization_id", org)
      .eq("lead_id", leadId)
      .eq("target_kind", "appointment");
    if (linkErr) {
      throw new Error(`[automation.engine] erro ao consultar crm_lead_links: ${linkErr.message}`);
    }
    linkApptIds = (links ?? []).map((l) => String(l.target_id)).filter(Boolean);
  }

  let appt: Record<string, unknown> | null = null;

  // 1. Tenta agendamento valido e futuro vinculado ao lead
  if (linkApptIds.length > 0) {
    const { data: linkedAppt, error: linkedErr } = await admin
      .from("calendar_appointments")
      .select("id, title, starts_at, ends_at, time_zone, status, notes, event_type_id, owner_user_id")
      .eq("organization_id", org)
      .in("id", linkApptIds)
      .in("status", ["pending", "confirmed"])
      .gte("starts_at", agoraRecente)
      .order("starts_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (linkedErr) {
      throw new Error(`[automation.engine] erro ao consultar calendar_appointments por link: ${linkedErr.message}`);
    }
    appt = linkedAppt;
  }

  // 2. Fallback: se o vinculo nao tinha reuniao valida futura, busca a do contato
  if (!appt && contactId) {
    const { data: contactAppt, error: contactErr } = await admin
      .from("calendar_appointments")
      .select("id, title, starts_at, ends_at, time_zone, status, notes, event_type_id, owner_user_id")
      .eq("organization_id", org)
      .eq("contact_id", contactId)
      .in("status", ["pending", "confirmed"])
      .gte("starts_at", agoraRecente)
      .order("starts_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (contactErr) {
      throw new Error(`[automation.engine] erro ao consultar calendar_appointments por contato: ${contactErr.message}`);
    }
    appt = contactAppt;
  }

  if (appt) {
    let tipoNome = appt.title as string;
    if (appt.event_type_id) {
      const { data: tipo, error: tipoErr } = await admin
        .from("calendar_event_types")
        .select("name")
        .eq("id", appt.event_type_id as string)
        .eq("organization_id", org)
        .maybeSingle();
      if (tipoErr) {
        throw new Error(`[automation.engine] erro ao buscar calendar_event_types: ${tipoErr.message}`);
      }
      if (tipo?.name) {
        tipoNome = tipo.name;
      }
    }

    let profNome: string | null = null;
    if (appt.owner_user_id) {
      profNome = await resolveUserName(admin, appt.owner_user_id as string, userNameCache);
    }

    const rawTz = typeof appt.time_zone === "string" ? appt.time_zone : null;
    const fuso = rawTz && fusoValido(rawTz) ? rawTz : FUSO_PADRAO;
    const dt = new Date(appt.starts_at as string);
    const p = partesNoFuso(dt, fuso);
    const dois = (n: number) => String(n).padStart(2, "0");
    const dataFmt = `${dois(p.dia)}/${dois(p.mes)}/${p.ano}`;
    const horaFmt = `${dois(p.hora)}:${dois(p.minuto)}`;
    const quandoFmt = rotuloLocal(dt, fuso);

    context.agendamento = {
      id: appt.id,
      titulo: appt.title,
      tipo: tipoNome,
      data: dataFmt,
      hora: horaFmt,
      quando: quandoFmt,
      profissional: profNome ?? "Equipe",
      atendente: profNome ?? "Equipe",
      status: appt.status,
      notas: (appt.notes as string | undefined) ?? "",
      starts_at: appt.starts_at,
    };
  }

  // Qualificacao do lead via IA (lead_state)
  if (contactId) {
    const { data: ls, error: lsErr } = await admin
      .from("lead_state")
      .select("stage, qualification, next_action")
      .eq("organization_id", org)
      .eq("contact_id", contactId)
      .maybeSingle();

    if (lsErr) {
      throw new Error(`[automation.engine] erro ao buscar lead_state: ${lsErr.message}`);
    }
    if (ls) {
      const q = (ls.qualification as Record<string, string> | null) ?? {};
      context.qualificacao = {
        estagio: ls.stage,
        stage: ls.stage,
        orcamento: q.budget ?? "",
        budget: q.budget ?? "",
        necessidade: q.need ?? "",
        need: q.need ?? "",
        autoridade: q.authority ?? "",
        authority: q.authority ?? "",
        prazo: q.timeline ?? "",
        timeline: q.timeline ?? "",
        proxima_acao: ls.next_action ?? "",
      };
    }
  }
}

/** Hidrata o contexto avaliado pelas condições/ações a partir do entity do evento. */
export async function buildContext(admin: SupabaseClient, row: EventRow): Promise<Record<string, unknown>> {
  const context: Record<string, unknown> = { event: row.payload };
  // Admin client bypassa RLS — todo lookup filtra organization_id do evento
  // (doutrina multi-tenant; um FK cross-org corrompido nunca vaza pro contexto).
  const org = row.organization_id;
  if (row.entity_kind === "crm_lead" && row.entity_id) {
    const { data: lead } = await admin
      .from("crm_leads")
      .select("*")
      .eq("id", row.entity_id)
      .eq("organization_id", org)
      .maybeSingle();
    if (lead) {
      context.lead = lead;
      context.campo = (lead.custom_fields as Record<string, unknown> | null) ?? {};
      context.custom_fields = context.campo;
      if (lead.contact_id) {
        const { data: contact } = await admin
          .from("contacts")
          .select("*")
          .eq("id", lead.contact_id)
          .eq("organization_id", org)
          .maybeSingle();
        if (contact) context.contact = contact;
      }
    }
  } else if (row.entity_kind === "contact" && row.entity_id) {
    const { data: contact } = await admin
      .from("contacts")
      .select("*")
      .eq("id", row.entity_id)
      .eq("organization_id", org)
      .maybeSingle();
    if (contact) context.contact = contact;
  } else if (row.entity_kind === "message" && row.entity_id) {
    const contactId = row.payload.contact_id as string | undefined;
    if (contactId) {
      const { data: contact } = await admin
        .from("contacts")
        .select("*")
        .eq("id", contactId)
        .eq("organization_id", org)
        .maybeSingle();
      if (contact) context.contact = contact;
    }
  }

  // Se o evento e de contato ou mensagem, tenta associar o lead mais recente do contato
  if (!context.lead && context.contact) {
    const contactId = (context.contact as { id: string }).id;
    let leadIdToFetch: string | null = null;

    if (row.event_type === "message.received") {
      const convId = row.payload.conversation_id as string | undefined;
      if (convId) {
        const { data: link } = await admin
          .from("crm_lead_links")
          .select("lead_id")
          .eq("organization_id", org)
          .eq("target_kind", "conversation")
          .eq("target_id", convId)
          .maybeSingle();
        if (link?.lead_id) {
          leadIdToFetch = String(link.lead_id);
        }
      }
    }

    if (leadIdToFetch) {
      const { data: lead } = await admin
        .from("crm_leads")
        .select("*")
        .eq("id", leadIdToFetch)
        .eq("organization_id", org)
        .maybeSingle();
      if (lead) {
        context.lead = lead;
      }
    } else {
      const { data: lead } = await admin
        .from("crm_leads")
        .select("*")
        .eq("organization_id", org)
        .eq("contact_id", contactId)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lead) {
        context.lead = lead;
      }
    }

    if (context.lead) {
      context.campo = ((context.lead as Record<string, unknown>).custom_fields as Record<string, unknown> | null) ?? {};
      context.custom_fields = context.campo;
    }
  }

  return context;
}

/**
 * Grava a linha do adiamento — a única evidência de que a regra casou e está
 * esperando.
 *
 * Um run por adiamento, e não um por tique do drain: o evento só volta na hora
 * marcada por `retry_at`, então não há repetição a cada minuto. Se a janela
 * seguir fechada quando ele voltar, sai outra linha — e aí a repetição É a
 * informação (a automação está presa há três dias).
 *
 * Fire-and-forget quanto a erro: perder o registro não pode impedir o
 * adiamento, que é o que protege o número.
 */
async function registrarAdiamento(
  admin: SupabaseClient,
  row: EventRow,
  rule: RuleRow,
  actionType: string,
  retryAt: string,
): Promise<void> {
  const { error } = await admin.from("automation_rule_runs").insert({
    organization_id: row.organization_id,
    rule_id: rule.id,
    event_id: row.id,
    status: "adiado",
    actions_result: [
      {
        type: actionType,
        status: "postponed",
        detail: {
          reason: "fora_da_janela_de_envio",
          retry_at: retryAt,
          explicacao:
            "A regra casou e está esperando a janela de envio do número reabrir — nada foi tentado ainda.",
        },
      },
    ],
  });
  if (error) {
    logger.error("[automation.engine] não foi possível registrar o adiamento", {
      rule_id: rule.id,
      organization_id: row.organization_id,
      error: error.message,
    });
  }
}

export async function runAutomationForEvent(
  admin: SupabaseClient,
  row: EventRow,
): Promise<HandlerResult> {
  const requestId = row.metadata?.request_id;
  const causedByRule =
    Boolean(row.metadata?.caused_by_rule) || (typeof requestId === "string" && requestId.startsWith("rule:"));
  if (causedByRule) {
    return { consumer_key: AUTOMATION_CONSUMER_KEY, status: "skipped", detail: "caused_by_rule" };
  }

  const expectedKind = EXPECTED_ENTITY_KIND[row.event_type];
  if (expectedKind && row.entity_kind !== expectedKind) {
  
    return { consumer_key: AUTOMATION_CONSUMER_KEY, status: "skipped", detail: "entity_kind_mismatch" };
  }

  const { data: rules, error } = await admin
    .from("automation_rules")
    .select("id, name, conditions, actions")
    .eq("organization_id", row.organization_id)
    .eq("trigger_event", row.event_type)
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  if (error) {
    return { consumer_key: AUTOMATION_CONSUMER_KEY, status: "error", detail: error.message };
  }
  const matched = (rules ?? []) as unknown as RuleRow[];
  if (!matched.length) {
    return { consumer_key: AUTOMATION_CONSUMER_KEY, status: "ok", detail: "no_rules" };
  }

  const context = await buildContext(admin, row);
  let enrichmentError: string | null = null;
  try {
    if (context.lead) {
      await enrichLeadContext(admin, row.organization_id, context.lead as Record<string, unknown>, context);
    }
  } catch (err) {
    enrichmentError = err instanceof Error ? err.message : String(err);
    logger.error("[automation.engine] erro ao enriquecer lead", { error: enrichmentError, event_id: row.id });
  }

  const applicable = matched.filter((r) => evaluateConditions(r.conditions ?? [], context));
  if (!applicable.length) {
    return { consumer_key: AUTOMATION_CONSUMER_KEY, status: "ok", detail: "no_match" };
  }

  // Pré-checagem de postpone (throttle etc.): all-or-nothing ANTES de executar
  // qualquer ação — reexecução parcial no retry seria pior que atraso.
  for (const rule of applicable) {
    for (const action of rule.actions ?? []) {
      const executor = getAction(action.type);
      if (!executor?.postponeUntil) continue;
      const until = await executor.postponeUntil(
        { admin, organizationId: row.organization_id, ruleId: rule.id, ruleName: rule.name, event: row, context, requestId: row.id },
        action.config ?? {},
      );
      if (until) {
        // A ESPERA É UM ESTADO, e um estado que ninguém vê é indistinguível de
        // morte. Sem esta linha o evento sumia até a janela reabrir e a aba
        // Atividade não mostrava NADA — para quem montou a regra, "não apareceu
        // nada" e "não rodou" são a mesma tela (migration 0175).
        await registrarAdiamento(admin, row, rule, action.type, until);
        return { consumer_key: AUTOMATION_CONSUMER_KEY, status: "retry", retry_at: until };
      }
    }
  }

  for (const rule of applicable) {
    const results: ActionResultDetail[] = [];
    
    if (enrichmentError) {
      results.push({ type: "enrichment", status: "failed", error: enrichmentError });
    }

    for (const action of rule.actions ?? []) {
      const executor = getAction(action.type);
      if (!executor) {
        results.push({ type: action.type, status: "failed", error: "unknown_action" });
        continue;
      }
      try {
        results.push(
          await executor.execute(
            { admin, organizationId: row.organization_id, ruleId: rule.id, ruleName: rule.name, event: row, context, requestId: row.id },
            action.config ?? {},
          ),
        );
      } catch (err) {
        results.push({
          type: action.type,
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // ═══ O AGREGADOR TAMBÉM PRECISA DIZER A VERDADE ═══
    //
    // `failed === 0 ? "success"` fazia uma ação `postponed` — mensagem que ficou
    // em `queued` e NÃO chegou ao cliente — virar "Sucesso" verde na tela. É o
    // MESMO defeito que `desfecho-do-envio.ts` existe para matar, ressurgindo
    // um nível acima: a ação passou a ser honesta e quem soma continuava
    // mentindo. Conserto por instância, não por classe.
    //
    // Achado por revisão adversarial, com o cenário alcançável: instalação sem
    // o transporte de WhatsApp configurado (o caso de TODA instalação nova), a
    // janela aberta, `postponeUntil` devolve null, a ação executa, e o envio
    // termina em `queued` com `queued_reason`. É exatamente o estado congelado
    // em `tests/invariants/automation-send-whatsapp.test.ts` caso 2.
    //
    // A MESMA mentira reapareceu de novo, um degrau abaixo: `status ===
    // "skipped"` (guarda-do-contato.ts — sem contato, bloqueado, sem telefone,
    // OU sem consentimento) também não era `failed` nem `postponed`, então caía
    // no `else` e virava "Sucesso" — pra uma mensagem que nunca foi NEM
    // TENTADA. Achado pelo e2e `tests/e2e/automacao-diz-a-verdade.spec.ts`: um
    // lead de webhook genérico (sem Respondi, sem pergunta de consentimento)
    // nunca tem `consent.marketing.granted_at`, então TODO envio automático
    // pra um lead assim batia no gate de consentimento — e a tela dizia
    // "Sucesso" pra um envio que nem chegou a discar o WhatsApp. Pior que o
    // defeito original: aquele pelo menos tinha TENTADO.
    //
    // `skipped` entra junto de `failed` na contagem: as duas significam "não
    // saiu, e não é a fila que vai resolver sozinha" — a diferença entre elas
    // (uma tentou e não conseguiu, a outra nem tentou) é o `reason`/`error` que
    // a ação já registra, não o status agregado.
    //
    // A ordem importa: falha (+ skip) vence adiamento. Uma regra em que uma
    // ação falhou/pulou e outra ficou esperando é `partial` — quem lê precisa
    // saber que algo quebrou, não que está tudo a caminho.
    const naoEnviadas = results.filter((r) => r.status === "failed" || r.status === "skipped").length;
    const adiados = results.filter((r) => r.status === "postponed").length;
    const status =
      naoEnviadas > 0
        ? naoEnviadas === results.length
          ? "failed"
          : "partial"
        : adiados > 0
          ? "adiado"
          : "success";
    const { data: runRow, error: runErr } = await admin
      .from("automation_rule_runs")
      .insert({
        organization_id: row.organization_id,
        rule_id: rule.id,
        event_id: row.id,
        status,
        actions_result: results,
      })
      .select("id")
      .maybeSingle();
    if (runErr) logger.error("[automation.engine] run insert failed", { error: runErr.message });

    // Audit só em falha/partial (spec §9) — não inflar audit em toda run.
    if (status !== "success") {
      void audit({
        action: "automation.rule_executed",
        organizationId: row.organization_id,
        resourceType: "automation_rule_run",
        resourceId: runRow?.id ?? null,
        metadata: { rule_id: rule.id, status, event_type: row.event_type },
      });
    }

    // run_count sem RPC de increment: read-modify-write é aceitável aqui
    // (contador informativo de UI, não invariante).
    const { data: cur } = await admin.from("automation_rules").select("run_count").eq("id", rule.id).maybeSingle();
    await admin
      .from("automation_rules")
      .update({ last_run_at: new Date().toISOString(), run_count: (cur?.run_count ?? 0) + 1 })
      .eq("id", rule.id);
  }

  return { consumer_key: AUTOMATION_CONSUMER_KEY, status: "ok" };
}
