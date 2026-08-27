/**
 * POST /api/v1/agenda/agendamentos — marcar.
 *
 * É o buraco que faltava no meio do produto: a tela existe, o motor de horários
 * livres existe, e sem isto ninguém consegue marcar nada.
 *
 * ─── A rota não pode discordar de si mesma ────────────────────────────────
 *
 * A validação do horário pedido usa **o mesmo `horariosLivres`** que responde o
 * `GET`. Reimplementar a checagem aqui — "está dentro da jornada? tem conflito?"
 * — criaria dois caminhos para a mesma pergunta, e dois caminhos divergem: o
 * `GET` ofereceria um horário que o `POST` recusa, ou pior, o contrário.
 *
 * ⚠️ E ISSO NÃO ELIMINA A CORRIDA. Entre a validação e o `INSERT` há uma janela:
 * dois pedidos simultâneos para o mesmo horário passam os dois. A migration 0177
 * explica por que não há constraint de sobreposição (`btree_gist` não está
 * disponível e quebraria o install de todo clone; e ela proibiria o encaixe
 * deliberado que uma recepção faz todo dia) — a decisão é consciente, e a
 * consequência é esta. Há proposta de um índice único parcial em
 * `(organization_id, owner_user_id, starts_at)` para status vivos, que barra o
 * duplo clique sem proibir encaixe; enquanto ele não existe, a janela está aqui
 * escrita em vez de existir e não estar.
 *
 * ⚠️ E O HEADER `Idempotency-Key` NÃO É HONRADO. O `CLAUDE.md` o promete para
 * POSTs de criação e `lib/api/client.ts` sempre o envia — mas
 * `lib/api/idempotency.ts` não existe, e `idempotency_conflict` é código de erro
 * sem nenhum emissor no repo. É cabo ligado sem ninguém do outro lado
 * escutando, e declarar isso é melhor que fingir que funciona.
 *
 * ─── O laço de retorno, no MESMO fluxo da mutação ─────────────────────────
 *
 * Marcar não é escrever uma linha. Os dois emissores saem daqui:
 * `crm_lead_activities` para o humano ver na timeline, e `event_log` para o
 * worker levar ao Google. Quem decide o QUE emitir é `lib/agenda/laco.ts`.
 */
import { randomUUID } from "node:crypto";

import { type NextRequest } from "next/server";
import { z } from "zod";

import { horariosLivresDaOrg } from "@/lib/agenda/consulta";
import {
  atividadeDaTransicao,
  precisaEmpurrarAoGoogle,
  type SituacaoAnterior,
  type Transicao,
} from "@/lib/agenda/laco";
import { ALVO_DE_VINCULO_DO_AGENDAMENTO, VINCULO_DE_AGENDAMENTO } from "@/lib/agenda/tipos";
import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { resolveActiveLeadForContact, type LeadCandidate } from "@/lib/leads/active-lead";
import { emitLeadActivity } from "@/lib/leads/activity-emitter";
import { registraFalhaDeAtividade } from "@/lib/leads/activity-write-failure";
import { createClient } from "@/lib/supabase/server";

/** A recusa da coleta vira o código de wire da API — um mapa, não um `if` espalhado. */
const CODIGO_DA_RECUSA = {
  tipo_desconhecido: "not_found",
  tipo_desativado: "agenda_tipo_desativado",
  sem_responsavel: "agenda_sem_responsavel",
  jornada_mal_configurada: "agenda_disponibilidade_invalida",
  erro_interno: "internal_error",
} as const;

const patchSchema = z
  .object({
    id: z.string().uuid(),
    /** Remarcar: o novo início. A duração vem do tipo, como na criação. */
    starts_at: z.string().datetime({ offset: true }).optional(),
    /**
     * A transição de situação. `rescheduled` NÃO entra aqui — remarcar se pede
     * mandando `starts_at`, e é movimento próprio (ver o cabeçalho do PATCH).
     */
    status: z.enum(["confirmed", "completed", "no_show"]).optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine((c) => c.starts_at !== undefined || c.status !== undefined || c.notes !== undefined, {
    message: "Informe pelo menos um campo para alterar.",
  });

const deleteSchema = z.object({
  id: z.string().uuid(),
  /**
   * ⚠️ OBRIGATÓRIO, e não é burocracia: é o que a equipe lê ao ver o horário
   * vago. "Cancelado" sem motivo faz alguém ligar para o cliente perguntando o
   * que houve — ou pior, não ligar.
   */
  reason: z.string().min(3).max(500),
});

const corpoSchema = z.object({
  event_type_id: z.string().uuid(),
  starts_at: z.string().datetime({ offset: true }),
  owner_user_id: z.string().uuid().optional(),
  contact_id: z.string().uuid().optional(),
  title: z.string().min(1).max(200).optional(),
  notes: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();

  // `agent` e não `viewer`: marcar é mutação, e quem só olha a agenda não marca.
  const authz = await requireRole("agent", { requestId, resource: "agenda" });
  if (!authz.ok) return authz.response;
  const { org: activeOrg, user } = authz;

  const bruto: unknown = await req.json().catch(() => null);
  const parsed = corpoSchema.safeParse(bruto);
  if (!parsed.success) {
    return fail("validation_failed", "Dados do agendamento inválidos.", 422, {
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
      requestId,
    });
  }

  const supabase = await createClient();
  const inicio = new Date(parsed.data.starts_at);

  const { data: tipo, error: erroTipo } = await supabase
    .from("calendar_event_types")
    .select(
      "id, name, is_active, duration_minutes, buffer_before_minutes, buffer_after_minutes, minimum_notice_minutes, slot_interval_minutes, booking_window_days, default_owner_user_id, requires_confirmation, location_kind, location_details",
    )
    .eq("organization_id", activeOrg.orgId)
    .eq("id", parsed.data.event_type_id)
    .maybeSingle();
  if (erroTipo) return fail("internal_error", erroTipo.message, 500, { requestId });
  if (!tipo) return fail("not_found", "Tipo de agendamento não encontrado.", 404, { requestId });
  if (!tipo.is_active) {
    return fail("agenda_tipo_desativado", `"${tipo.name}" está desativado.`, 422, { requestId });
  }

  const donoId = parsed.data.owner_user_id ?? tipo.default_owner_user_id;
  if (!donoId) {
    return fail(
      "agenda_sem_responsavel",
      `"${tipo.name}" não tem responsável definido, e sem responsável não há agenda.`,
      422,
      { requestId },
    );
  }

  const fim = new Date(inicio.getTime() + tipo.duration_minutes * 60_000);

  // ⚠️ A MESMA COLETA QUE RESPONDE O GET E AS FERRAMENTAS MCP — não uma segunda.
  //
  // A versão anterior desta rota refazia as buscas aqui, com um comentário
  // dizendo que era "o mesmo motor". Era o mesmo motor e uma SEGUNDA COLETA, e
  // isso diverge no primeiro ajuste: se a regra do que OCUPA mudar (por
  // exemplo, `pending` deixar de ocupar), `consulta.ts` muda e a cópia não —
  // e aí a tela oferece horário que este POST recusa, ou pior, o POST aceita um
  // que a tela não ofereceu e alguém chega numa hora que já tinha dono.
  //
  // Duplicação consciente diverge igual à inconsciente; a única diferença é que
  // a consciente tem a quem perguntar. O comentário que admitia não impedia
  // nada — só registrava quem avisar depois. (Achado do MaestroConexoes.)
  const consulta = await horariosLivresDaOrg(supabase, activeOrg.orgId, {
    eventTypeId: tipo.id,
    ownerUserId: donoId,
    de: inicio,
    ate: fim,
    agora: new Date(),
  });

  if (!consulta.ok) {
    return fail(CODIGO_DA_RECUSA[consulta.codigo], consulta.motivoParaOperador, 422, { requestId });
  }
  if (!consulta.publicouHorarios) {
    return fail(
      "agenda_fora_da_jornada",
      "Este responsável ainda não publicou horários de atendimento.",
      422,
      { requestId },
    );
  }

  const oferecido = consulta.slots.some((s) => s.inicio.getTime() === inicio.getTime());
  if (!oferecido) {
    return fail(
      "agenda_horario_indisponivel",
      "Este horário não está disponível. Consulte os horários livres e escolha outro.",
      422,
      { requestId },
    );
  }

  const { data: criado, error: erroInsert } = await supabase
    .from("calendar_appointments")
    .insert({
      organization_id: activeOrg.orgId,
      event_type_id: tipo.id,
      title: parsed.data.title ?? tipo.name,
      starts_at: inicio.toISOString(),
      ends_at: fim.toISOString(),
      // ⚠️ O FUSO DO COMPROMISSO É CAMPO DE PRIMEIRA CLASSE (ACHADO 09).
      //
      // É o fuso da JORNADA — onde o horário foi decidido — e não o de quem
      // clicou. "Quinta às 14h" é o que se combinou, e o instante UTC sozinho
      // não reconstrói isso depois de uma virada de horário de verão.
      //
      // E ele precisa viajar até o lembrete: a janela anti-banimento é avaliada
      // no fuso do TENANT, e o compromisso tem o dele. Sem este campo no
      // payload, o handler adivinha — e adivinhar fuso é como este produto já
      // errou antes.
      time_zone: consulta.fusoDaRegra,
      status: tipo.requires_confirmation ? "pending" : "confirmed",
      owner_user_id: donoId,
      contact_id: parsed.data.contact_id ?? null,
      location_kind: tipo.location_kind,
      location_details: tipo.location_details,
      notes: parsed.data.notes ?? null,
      created_by_kind: "user",
      created_by_user_id: user.id,
      source: "ui",
    })
    .select("id, starts_at, ends_at, status, time_zone")
    .single();
  if (erroInsert) return fail("internal_error", erroInsert.message, 500, { requestId });

  const transicao = criado.status === "pending" ? "pending" : "confirmed";
  await fecharOLaco({
    supabase,
    orgId: activeOrg.orgId,
    appointmentId: criado.id,
    contactId: parsed.data.contact_id ?? null,
    atividade: atividadeDaTransicao(null, transicao),
    empurrarAoGoogle: precisaEmpurrarAoGoogle(null, transicao),
    fusoDoCompromisso: criado.time_zone,
    userId: user.id,
    nomeDoTipo: tipo.name,
  });

  void audit({
    action: "agenda.appointment_created",
    actorUserId: user.id,
    organizationId: activeOrg.orgId,
    resourceType: "calendar_appointment",
    resourceId: criado.id,
    requestId,
    metadata: { event_type_id: tipo.id, owner_user_id: donoId, time_zone: criado.time_zone },
  });

  return ok(criado, { status: 201, requestId });
}

/**
 * Os DOIS emissores do laço, no mesmo fluxo da mutação.
 *
 * ⚠️ `crm_lead_activities.lead_id` é NOT NULL, então agendamento de contato que
 * ainda não virou lead não tem onde ancorar a atividade. O produto já resolveu
 * isso: quando não há negócio a que pertencer, o rastro vira `event_log` por
 * `registraFalhaDeAtividade`, em vez de sumir. Não se inventa um terceiro
 * caminho aqui.
 */
async function fecharOLaco(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  orgId: string;
  appointmentId: string;
  contactId: string | null;
  atividade: string | null;
  empurrarAoGoogle: boolean;
  fusoDoCompromisso: string;
  userId: string;
  nomeDoTipo: string;
}): Promise<void> {
  if (args.empurrarAoGoogle) {
    // ⚠️ ESTE EVENTO AINDA NÃO TEM CONSUMIDOR, E O SILÊNCIO É TOTAL.
    //
    // Medido: `agenda.appointment.push_to_google` aparece UMA vez no repo — esta
    // linha, que emite. Nenhum handler o declara em `register-handlers.ts`.
    //
    // O QUE ACONTECE COM ELE, na cadeia inteira e não no meio dela:
    //
    //   drain.ts:39  `handledTypes` = a união dos `events` dos handlers registrados
    //   drain.ts:54  `.in("event_type", handledTypes)` — o SELECT já o exclui
    //
    // A linha NUNCA É SELECIONADA. Fica `status: "pending"` para sempre: não vira
    // `dead`, não conta tentativa, não acende o aviso da Central, não entra em
    // log nenhum. E ninguém olha — medido: não há cron, sonda, contagem ou
    // alerta sobre `event_log` parado em `pending` (controle: a palavra aparece
    // 5 vezes em `drain.ts`, então a busca estava viva).
    //
    // ⚠️ NÃO É o `if (!matches.length) return []` do `dispatcher.ts:85`. Aquele
    // dispara em OUTRA condição — o tipo É declarado por algum handler, mas
    // todos já estão em `consumed_by` — e ali o `done` está CERTO, porque todos
    // os consumidores rodaram. Uma versão anterior deste comentário ligava as
    // duas coisas e concluía que o evento era marcado como concluído. Era falso:
    // ele não chega ao dispatcher.
    //
    // Quem sente: o profissional, cujo compromisso não aparece na agenda do
    // Google dele, e o cliente que marcou. O sistema não fica sabendo.
    //
    // O consumidor é da frente 3. A emissão fica porque o contrato é este e o
    // payload já carrega o que o handler vai precisar (inclusive o fuso,
    // ACHADO 09); o que falta é do outro lado, e está reportado.
    await args.supabase.from("event_log").insert({
      organization_id: args.orgId,
      event_type: "agenda.appointment.push_to_google",
      entity_kind: "calendar_appointment",
      entity_id: args.appointmentId,
      // O fuso viaja com o evento (ACHADO 09): quem consumir não adivinha.
      payload: { appointment_id: args.appointmentId, time_zone: args.fusoDoCompromisso },
    });
  }

  if (!args.atividade) return;

  const leadId = args.contactId
    ? await leadAtivoDoContato(args.supabase, args.orgId, args.contactId)
    : null;

  if (leadId) {
    // ⚠️ O VÍNCULO E A ATIVIDADE SÃO DOIS EMISSORES, NÃO UM (DECISÃO 6 +
    // invariante 3). A linha em `crm_lead_links` é o que faz o compromisso
    // PERTENCER ao negócio — é por ela que o dossiê do lead sabe listar os
    // agendamentos dele. A atividade é outra coisa: é o que aparece na TIMELINE.
    //
    // Só o vínculo e nada aparece na tela; só a atividade e o dossiê não acha o
    // compromisso. Uma linha de link sozinha não põe um pixel em lugar nenhum.
    //
    // `target_kind` e `link_kind` vêm das CONSTANTES de `lib/agenda/tipos.ts`,
    // nunca da string literal: `link_kind` é coluna de vocabulário ABERTO (sem
    // CHECK, para não quebrar o `update.sh` de clone com valor legado), então o
    // TypeScript é a única fonte que resta.
    await args.supabase.from("crm_lead_links").insert({
      organization_id: args.orgId,
      lead_id: leadId,
      target_kind: ALVO_DE_VINCULO_DO_AGENDAMENTO,
      target_id: args.appointmentId,
      link_kind: VINCULO_DE_AGENDAMENTO,
      created_by_user_id: args.userId,
    });
  }

  if (!leadId) {
    if (args.contactId) {
      await registraFalhaDeAtividade(args.supabase, {
        organizationId: args.orgId,
        // Sem negócio não há âncora; o contato é o que se sabe, e vai no lugar
        // do id para o alerta não sair mudo sobre QUEM ficou sem rastro. É o
        // mesmo gesto de `lib/followup/retorno-crm.ts`.
        leadId: args.contactId,
        tipo: args.atividade,
        origem: "agenda.post (sem negócio aberto para ancorar)",
        erro: undefined,
      });
    }
    return;
  }

  await emitLeadActivity(args.supabase, {
    organizationId: args.orgId,
    leadId,
    contactId: args.contactId,
    type: args.atividade as never,
    sourceModule: "agenda",
    sourceId: args.appointmentId,
    actor: { type: "user", id: args.userId },
    reason: `${args.nomeDoTipo} marcado pela equipe`,
  });
}

/**
 * O negócio ativo do contato — pela MESMA régua do resto do produto.
 *
 * ⚠️ A versão anterior reimplementava a decisão aqui, com um comentário dizendo
 * que era "a mesma régua de `resolveActiveLeadForContact`". Era uma SEGUNDA
 * implementação declarada, e duplicação consciente diverge no primeiro ajuste
 * igual à inconsciente — a única diferença é que a consciente tem a quem
 * perguntar depois. O comentário que admite não impede; só registra quem avisar.
 *
 * A regra de verdade mora em `lib/leads/active-lead.ts` e distingue três
 * desfechos que um `limit(2)` não distingue: roteou, `no_open_lead` e
 * `ambiguous_open_leads`. Os dois últimos NÃO são erro — o agendamento existe e
 * a atividade não nasce, porque não há negócio a que ancorar.
 */
async function leadAtivoDoContato(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  contactId: string,
): Promise<string | null> {
  const [{ data: candidatos }, { data: padrao }] = await Promise.all([
    supabase
      .from("crm_leads")
      .select("id, organization_id, pipeline_id, status, last_activity_at, created_at")
      .eq("organization_id", orgId)
      .eq("contact_id", contactId),
    supabase
      .from("crm_pipelines")
      .select("id")
      .eq("organization_id", orgId)
      .eq("is_default", true)
      .eq("is_archived", false)
      .maybeSingle(),
  ]);

  const rota = resolveActiveLeadForContact((candidatos ?? []) as LeadCandidate[], {
    defaultPipelineId: (padrao as { id: string } | null)?.id ?? null,
  });
  return rota.routed ? rota.leadId : null;
}

/**
 * PATCH /api/v1/agenda/agendamentos — remarcar, confirmar, registrar o desfecho.
 *
 * ⚠️ REMARCAR NÃO É CANCELAR MAIS CRIAR, e a diferença tem três consequências.
 *
 * É a MESMA linha que muda de horário, não uma nova encadeada:
 *
 * 1. A TIMELINE conta a história certa. Cancelar+criar emitiria
 *    `appointment_cancelled` seguido de `appointment_scheduled` — duas linhas
 *    dizendo que o cliente desistiu e voltou. Ele só mudou de horário.
 * 2. O ESPELHO NO GOOGLE é atualizado, não destruído e refeito. Recriar exigiria
 *    casar o evento antigo lá fora para apagá-lo, e casar evento externo por
 *    janela de horário erra nos dois sentidos — está barrado até existir
 *    identificador próprio no espelho.
 * 3. O `id` que o cliente já recebeu continua valendo.
 *
 * `rescheduled_from_id` NÃO é usado por este verbo. Ele existe para o fluxo em
 * que a remarcação gera compromisso NOVO — auto-agendamento pelo cliente, que
 * não existe ainda. Deixá-lo vazio aqui é a leitura fiel do schema; usá-lo seria
 * inventar encadeamento onde há uma linha só.
 *
 * O horário novo passa pela MESMA validação da criação: a coleta de
 * `consulta.ts`, nunca uma segunda.
 */
export async function PATCH(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();

  const authz = await requireRole("agent", { requestId, resource: "agenda" });
  if (!authz.ok) return authz.response;
  const { org: activeOrg, user } = authz;

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("validation_failed", "Alteração inválida.", 422, {
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
      requestId,
    });
  }

  const supabase = await createClient();

  const { data: atual, error: erroBusca } = await supabase
    .from("calendar_appointments")
    .select("id, event_type_id, owner_user_id, contact_id, starts_at, status, time_zone")
    .eq("organization_id", activeOrg.orgId)
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (erroBusca) return fail("internal_error", erroBusca.message, 500, { requestId });
  if (!atual) return fail("not_found", "Agendamento não encontrado.", 404, { requestId });
  if (atual.status === "cancelled") {
    return fail(
      "agenda_ja_cancelado",
      "Este agendamento foi cancelado. Marque um novo em vez de reabrir este.",
      422,
      { requestId },
    );
  }

  const mudanca: Record<string, unknown> = {};
  if (parsed.data.notes !== undefined) mudanca.notes = parsed.data.notes;

  let transicao: Transicao | null = null;

  if (parsed.data.starts_at) {
    const novoInicio = new Date(parsed.data.starts_at);
    const { data: tipo } = await supabase
      .from("calendar_event_types")
      .select("id, duration_minutes")
      .eq("organization_id", activeOrg.orgId)
      .eq("id", atual.event_type_id ?? "")
      .maybeSingle();
    if (!tipo) {
      return fail("not_found", "O tipo deste agendamento não existe mais.", 404, { requestId });
    }
    const novoFim = new Date(novoInicio.getTime() + tipo.duration_minutes * 60_000);

    const consulta = await horariosLivresDaOrg(supabase, activeOrg.orgId, {
      eventTypeId: tipo.id,
      ownerUserId: atual.owner_user_id,
      de: novoInicio,
      ate: novoFim,
      agora: new Date(),
    });
    if (!consulta.ok) {
      return fail(CODIGO_DA_RECUSA[consulta.codigo], consulta.motivoParaOperador, 422, { requestId });
    }
    // ⚠️ O PRÓPRIO COMPROMISSO OCUPA O HORÁRIO DELE. Remarcar para o MESMO
    // instante não é erro — é no-op — e sem esta linha ele se veria como
    // conflito e recusaria a si mesmo.
    const mesmoHorario = new Date(atual.starts_at).getTime() === novoInicio.getTime();
    if (!mesmoHorario && !consulta.slots.some((s) => s.inicio.getTime() === novoInicio.getTime())) {
      return fail(
        "agenda_horario_indisponivel",
        "Este horário não está disponível. Consulte os horários livres e escolha outro.",
        422,
        { requestId },
      );
    }
    if (!mesmoHorario) {
      mudanca.starts_at = novoInicio.toISOString();
      mudanca.ends_at = novoFim.toISOString();
      mudanca.time_zone = consulta.fusoDaRegra;
      transicao = "rescheduled";
    }
  }

  if (parsed.data.status && parsed.data.status !== atual.status) {
    mudanca.status = parsed.data.status;
    // Remarcar vence: se vieram os dois, a notícia da timeline é a remarcação.
    transicao = transicao ?? parsed.data.status;
  }

  if (Object.keys(mudanca).length === 0) {
    return ok({ id: atual.id, inalterado: true }, { requestId });
  }

  const { data: salvo, error: erroUpdate } = await supabase
    .from("calendar_appointments")
    .update(mudanca)
    .eq("organization_id", activeOrg.orgId)
    .eq("id", atual.id)
    .select("id, starts_at, ends_at, status, time_zone")
    .single();
  if (erroUpdate) return fail("internal_error", erroUpdate.message, 500, { requestId });

  if (transicao) {
    await fecharOLaco({
      supabase,
      orgId: activeOrg.orgId,
      appointmentId: atual.id,
      contactId: atual.contact_id,
      atividade: atividadeDaTransicao(atual.status as SituacaoAnterior, transicao),
      empurrarAoGoogle: precisaEmpurrarAoGoogle(atual.status as SituacaoAnterior, transicao),
      fusoDoCompromisso: salvo.time_zone,
      userId: user.id,
      nomeDoTipo: "Agendamento",
    });

    // ⚠️ `completed` e `no_show` NÃO são auditados, e é decisão do maestro: não
    // são mutação de intenção, são registro de fato já consumado no mundo, e
    // vivem na timeline do lead. Procurar o tipo de audit deles aqui e não achar
    // é o comportamento esperado.
    if (transicao === "rescheduled") {
      void audit({
        action: "agenda.appointment_rescheduled",
        actorUserId: user.id,
        organizationId: activeOrg.orgId,
        resourceType: "calendar_appointment",
        resourceId: atual.id,
        requestId,
        metadata: { de: atual.starts_at, para: salvo.starts_at },
      });
    }
  }

  return ok(salvo, { requestId });
}

/**
 * DELETE /api/v1/agenda/agendamentos — cancelar.
 *
 * Cancela de verdade (status), não apaga a linha: o histórico do que foi marcado
 * e desmarcado é o que permite ao Radar distinguir lead que desistiu de lead que
 * nunca marcou, e ao agente não reoferecer o horário que a pessoa recusou.
 *
 * ⚠️ O MOTIVO É OBRIGATÓRIO e o Zod cobra. É o que a equipe lê ao ver o horário
 * vago — sem ele, alguém liga para o cliente perguntando o que houve, ou não
 * liga e o lead esfria sem ninguém saber por quê.
 */
export async function DELETE(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();

  const authz = await requireRole("agent", { requestId, resource: "agenda" });
  if (!authz.ok) return authz.response;
  const { org: activeOrg, user } = authz;

  const parsed = deleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("validation_failed", "Cancelamento inválido: informe o motivo.", 422, {
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
      requestId,
    });
  }

  const supabase = await createClient();

  const { data: atual, error: erroBusca } = await supabase
    .from("calendar_appointments")
    .select("id, contact_id, status, time_zone")
    .eq("organization_id", activeOrg.orgId)
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (erroBusca) return fail("internal_error", erroBusca.message, 500, { requestId });
  if (!atual) return fail("not_found", "Agendamento não encontrado.", 404, { requestId });
  if (atual.status === "cancelled") {
    // Idempotente: cancelar o que já está cancelado devolve o estado, não erro.
    // Quem chamou queria o compromisso desmarcado, e ele está.
    return ok({ id: atual.id, status: "cancelled", ja_estava: true }, { requestId });
  }

  const { data: salvo, error: erroUpdate } = await supabase
    .from("calendar_appointments")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: parsed.data.reason,
    })
    .eq("organization_id", activeOrg.orgId)
    .eq("id", atual.id)
    .select("id, status, cancelled_at, cancellation_reason")
    .single();
  if (erroUpdate) return fail("internal_error", erroUpdate.message, 500, { requestId });

  await fecharOLaco({
    supabase,
    orgId: activeOrg.orgId,
    appointmentId: atual.id,
    contactId: atual.contact_id,
    atividade: atividadeDaTransicao(atual.status as SituacaoAnterior, "cancelled"),
    empurrarAoGoogle: precisaEmpurrarAoGoogle(atual.status as SituacaoAnterior, "cancelled"),
    fusoDoCompromisso: atual.time_zone,
    userId: user.id,
    nomeDoTipo: "Agendamento",
  });

  void audit({
    action: "agenda.appointment_cancelled",
    actorUserId: user.id,
    organizationId: activeOrg.orgId,
    resourceType: "calendar_appointment",
    resourceId: atual.id,
    requestId,
    metadata: { reason: parsed.data.reason },
  });

  return ok(salvo, { requestId });
}
