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

import { horariosLivres, type ExcecaoDeData } from "@/lib/agenda/horarios-livres";
import { lerJornadaDoBanco } from "@/lib/agenda/jornada";
import { atividadeDaTransicao, precisaEmpurrarAoGoogle } from "@/lib/agenda/laco";
import { ocupadosDoDono, type LinhaDeAgendamento, type LinhaDeEventoExterno } from "@/lib/agenda/ocupados";
import { ALVO_DE_VINCULO_DO_AGENDAMENTO, VINCULO_DE_AGENDAMENTO } from "@/lib/agenda/tipos";
import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { emitLeadActivity } from "@/lib/leads/activity-emitter";
import { registraFalhaDeAtividade } from "@/lib/leads/activity-write-failure";
import { createClient } from "@/lib/supabase/server";

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
    return fail("validation_failed", `"${tipo.name}" está desativado.`, 422, { requestId });
  }

  const donoId = parsed.data.owner_user_id ?? tipo.default_owner_user_id;
  if (!donoId) {
    return fail(
      "validation_failed",
      `"${tipo.name}" não tem responsável definido, e sem responsável não há agenda.`,
      422,
      { requestId },
    );
  }

  const { data: disponibilidade } = await supabase
    .from("attendant_availability")
    .select("schedule")
    .eq("organization_id", activeOrg.orgId)
    .eq("user_id", donoId)
    .maybeSingle();

  const leitura = lerJornadaDoBanco(disponibilidade?.schedule);
  if (!leitura.ok) {
    return fail(
      "validation_failed",
      `A disponibilidade deste responsável está mal configurada: ${leitura.motivoParaOperador}`,
      422,
      { requestId },
    );
  }
  if (!leitura.publicouHorarios) {
    return fail(
      "validation_failed",
      "Este responsável ainda não publicou horários de atendimento.",
      422,
      { requestId },
    );
  }

  const fim = new Date(inicio.getTime() + tipo.duration_minutes * 60_000);
  const livres = await horariosLivresDoDia({
    supabase,
    orgId: activeOrg.orgId,
    donoId,
    jornada: leitura.jornada,
    tipo,
    de: inicio,
    ate: fim,
  });

  const oferecido = livres.some((s) => s.inicio.getTime() === inicio.getTime());
  if (!oferecido) {
    // Não é 409 nem 500: o horário pedido simplesmente não está entre os que
    // esta agenda oferece. A frase diz o que fazer, não só que não deu.
    return fail(
      "validation_failed",
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
      time_zone: leitura.jornada.timezone,
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

/** Os horários livres do recorte pedido — o MESMO motor que responde o `GET`. */
async function horariosLivresDoDia(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  orgId: string;
  donoId: string;
  jornada: { timezone: string; windows: { dow: number; start: string; end: string }[] };
  tipo: {
    duration_minutes: number;
    buffer_before_minutes: number;
    buffer_after_minutes: number;
    minimum_notice_minutes: number;
    slot_interval_minutes: number | null;
    booking_window_days: number;
  };
  de: Date;
  ate: Date;
}) {
  const dia = args.de.toISOString().slice(0, 10);
  const [{ data: excecoesRaw }, { data: agendaRaw }, { data: externosRaw }] = await Promise.all([
    args.supabase
      .from("calendar_availability_exceptions")
      .select("exception_date, is_unavailable, start_minute, end_minute")
      .eq("organization_id", args.orgId)
      .eq("user_id", args.donoId)
      .eq("exception_date", dia),
    args.supabase
      .from("calendar_appointments")
      .select("starts_at, ends_at, status")
      .eq("organization_id", args.orgId)
      .eq("owner_user_id", args.donoId)
      .lt("starts_at", args.ate.toISOString())
      .gt("ends_at", args.de.toISOString()),
    args.supabase
      .from("calendar_external_events")
      .select("starts_at, ends_at, transparency, status, calendar_connections!inner(user_id, status)")
      .eq("organization_id", args.orgId)
      .eq("calendar_connections.user_id", args.donoId)
      .lt("starts_at", args.ate.toISOString())
      .gt("ends_at", args.de.toISOString()),
  ]);

  const excecoes: ExcecaoDeData[] = (excecoesRaw ?? []).map((l) => ({
    data: String(l.exception_date).slice(0, 10),
    indisponivel: l.is_unavailable,
    inicioMinuto: l.start_minute,
    fimMinuto: l.end_minute,
  }));

  const { ocupados } = ocupadosDoDono(
    (agendaRaw ?? []) as LinhaDeAgendamento[],
    (externosRaw ?? []).map((l) => {
      const conexao = l.calendar_connections as unknown as { status?: string } | null;
      return {
        starts_at: l.starts_at,
        ends_at: l.ends_at,
        transparency: l.transparency,
        status: l.status,
        situacaoDaConexao: conexao?.status ?? "error",
      } satisfies LinhaDeEventoExterno;
    }),
  );

  return horariosLivres({
    jornada: args.jornada,
    excecoes,
    ocupados,
    tipo: {
      duracaoMin: args.tipo.duration_minutes,
      bufferAntesMin: args.tipo.buffer_before_minutes,
      bufferDepoisMin: args.tipo.buffer_after_minutes,
      avisoMinimoMin: args.tipo.minimum_notice_minutes,
      intervaloMin: args.tipo.slot_interval_minutes,
      janelaDias: args.tipo.booking_window_days,
    },
    de: args.de,
    ate: args.ate,
    agora: new Date(),
  });
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

async function leadAtivoDoContato(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  contactId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("crm_leads")
    .select("id")
    .eq("organization_id", orgId)
    .eq("contact_id", contactId)
    .not("status", "in", "(won,lost)")
    .order("last_activity_at", { ascending: false })
    .limit(2);
  // Dois negócios abertos = ambíguo, e o produto NÃO adivinha (é a mesma régua
  // de `resolveActiveLeadForContact`). Sem âncora certa, o rastro vira evento.
  return data?.length === 1 ? (data[0]?.id ?? null) : null;
}
