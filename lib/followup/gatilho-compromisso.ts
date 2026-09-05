/**
 * Gatilho de COMPROMISSO MARCADO (`trigger_config.kind='appointment_upcoming'`)
 * — o follow-up passa a nascer sozinho quando falta pouco para uma hora que
 * alguém combinou com o cliente.
 *
 * ## O disparador que a 0194 mandou esperar
 *
 * `calendar_event_types.reminder_enabled` nasceu `default true` na 0177 e a
 * migration 0194 o desligou com um argumento explícito: não havia disparador
 * nenhum, e ligar por padrão inscreveria o histórico inteiro de toda instalação
 * numa ação irreversível — mandar mensagem a uma pessoa — que ninguém escolheu.
 * A 0194 termina dizendo que ligar é decisão do dono do produto "NO DIA em que
 * o disparador nascer". Este arquivo é aquele dia: as três colunas `reminder_*`
 * tinham ZERO leitores até aqui.
 *
 * ## A DIVISÃO entre o fluxo e o cadastro (por que o gatilho só tem um param)
 *
 * Duas perguntas diferentes, cada uma no lugar onde ela é respondida:
 *
 *   - **QUAIS compromissos lembram** é do CADASTRO: `reminder_enabled`, um
 *     interruptor por tipo de atendimento, em Ajustes › Agenda. Uma clínica
 *     lembra a consulta e não lembra a reunião interna, e essa distinção é do
 *     tipo, não do fluxo.
 *   - **QUANTO ANTES** é do FLUXO: `params.minutes_before`. É do fluxo que sai a
 *     frase, e quem escreve "faltam 60 minutos" precisa mandar nos 60.
 *
 * `reminder_minutes_before` fica declarada NÃO LIDA na 0213 em vez de virar a
 * segunda resposta para a pergunta que o fluxo já responde. Duas fontes com o
 * mesmo nome divergem no primeiro ajuste, e a que perde é sempre a que ninguém
 * abriu.
 *
 * ⚠️ COMPROMISSO SEM TIPO NUNCA LEMBRA. `event_type_id` é nullable, e um
 * compromisso sem tipo não tem interruptor — logo não tem escolha registrada de
 * ninguém. O silêncio aqui é deliberado e é o lado seguro: o contrário faria a
 * marcação avulsa ser o único caso que dispara sem consentimento. O sweep conta
 * esses casos em `sem_lembrete_ligado` para que a omissão apareça na auditoria
 * em vez de virar um `continue` mudo (invariante 6 do Sistema Vivo).
 *
 * ## TIME-DRIVEN, e por que não é `cron_jobs`
 *
 * Mesmo formato do `silence-sweep.ts`: varredura periódica dentro do tick do
 * cron `followup-flow-worker`. Um job agendado em `cron_jobs` no momento da
 * marcação pareceria mais direto e seria pior — o compromisso REMARCA, CANCELA
 * e muda de status, e cada uma dessas mudanças exigiria achar e reescrever o
 * job. A varredura relê o estado atual a cada minuto: cancelou, sai da consulta
 * sozinho.
 *
 * ⚠️ REMARCAR NÃO SAI DE GRAÇA, e esta frase já esteve errada aqui. Remarcar é
 * UPDATE na MESMA linha (`rescheduled_from_id` fica vazio, por doutrina escrita
 * em `agendamentos/_handler.ts`), então a marca de idempotência sobreviveria à
 * mudança de hora e o compromisso remarcado nunca mais seria visto. Quem fecha
 * isso é o handler, que zera `reminder_sent_at` no mesmo UPDATE que muda
 * `starts_at`. A idempotência é sobre A HORA, não sobre a linha — e quem
 * garante é código lá, não a natureza da varredura.
 *
 * ⚠️ CANCELAR O COMPROMISSO NÃO CANCELA UM LEMBRETE JÁ EM VOO. O compromisso
 * cancelado some da varredura, mas o acompanhamento que já nasceu segue seu
 * caminho: num fluxo com nó de espera, o cliente recebe um lembrete de algo que
 * foi desmarcado. Limite conhecido e declarado — fechá-lo pede o mesmo par que
 * `gatilho-caso.ts` tem (o que abre sabe fechar), e isso não entrou nesta
 * entrega.
 *
 * O que já NÃO acontece mais é a frase sair com a hora em branco: o resolvedor
 * lê o compromisso pelo id fixado na proveniência, sem filtro de status
 * (`variaveis-do-compromisso.ts`). Dizer "às " é pior que dizer a hora de algo
 * que acabou de ser desmarcado — a segunda frase o cliente entende e responde.
 *
 * A janela é `now <= starts_at <= now + minutes_before`, e o limite de baixo é
 * o que torna isto AUTO-CURATIVO sem virar spam: cron parado vinte minutos
 * manda o lembrete atrasado (ainda antes da hora, que é o que importa), e
 * compromisso que já começou some da consulta — ninguém recebe "faltam 60
 * minutos" depois de a reunião ter passado.
 *
 * ⚠️ UM FLUXO DESTE KIND POR ORGANIZAÇÃO — recusado no publish
 * (`trigger_appointment_flow_exists`), e a razão é a idempotência: ela é UMA
 * coluna por compromisso, não uma por (compromisso, fluxo). Com dois fluxos
 * armados por compromisso, o de janela MAIOR marca o compromisso primeiro e o
 * outro nunca mais o enxerga — não vira `skipped_existing`, não vira erro, não
 * vira contador: o fluxo fica `active` e não dispara uma vez sequer. Quem quiser
 * "um dia antes" E "uma hora antes" convivendo precisa de idempotência por par,
 * numa tabela própria; enquanto ela não existe, a recusa é a única barreira
 * honesta.
 *
 * Idempotência: `calendar_appointments.reminder_sent_at`, a coluna que a 0177
 * criou e que também não tinha leitor. Marcada DEPOIS do enrollment nascer, não
 * antes — marcar primeiro trocaria "mandou duas vezes" por "nunca mandou", e
 * entre os dois defeitos o segundo é o que o cliente não perdoa. O índice
 * único de vivos protege o outro lado.
 *
 * ## ⚠️ O LEMBRETE TEM PRIORIDADE, e isso CANCELA acompanhamento vivo
 *
 * `idx_followup_enrollments_one_live` é org-wide `(organization_id, contact_id)`:
 * um contato vivo em QUALQUER fluxo barraria o insert. Nos outros gatilhos esse
 * 23505 vira `skipped_existing` e ninguém fica sabendo — aqui isso seria o
 * cliente chegando sem aviso a uma hora marcada porque uma régua de nutrição
 * estava no meio. Hora combinada com uma pessoa vale mais que nutrição, então o
 * sweep CANCELA o acompanhamento vivo (`cancel_reason='lembrete_de_compromisso'`)
 * e entra no lugar. É decisão do dono do produto, tomada com o mecanismo na
 * frente, e o `cancel_reason` é o que permite auditar depois quantas réguas o
 * lembrete interrompeu.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { flowGraphSchema } from "./graph-schema";
import { triggerConfigSchema } from "./api-schemas";
import { resolveAgentForAutomaticTrigger, type FollowupGateDb } from "./agent-followup-gate";

/** O motivo gravado no acompanhamento que o lembrete interrompeu. Constante
 *  porque o sweep, a leitura da fila e os testes precisam do MESMO literal. */
export const CANCELADO_PELO_LEMBRETE = "lembrete_de_compromisso";

/**
 * O evento que diz QUAL compromisso abriu o acompanhamento.
 *
 * Constante compartilhada porque três lados precisam do MESMO literal: quem
 * grava (o sweep), quem LÊ para montar o texto da mensagem
 * (`variaveis-do-compromisso.ts`) e quem traduz na timeline
 * (`eventos-legiveis.ts`). Uma cópia divergente aqui não daria erro — o
 * resolvedor simplesmente não acharia a linha e voltaria ao palpite.
 */
export const EVENTO_DE_PROVENIENCIA = "enrolled_by_appointment";

/** Os dois estados em que um compromisso ainda vai acontecer. Cancelado,
 *  realizado e falta não seguram ninguém — e não se lembra o que já passou. */
export const STATUS_VIVOS_DO_COMPROMISSO = ["pending", "confirmed"] as const;

/**
 * Os estados que o índice único de vivos considera ocupados.
 *
 * ⚠️ OS QUATRO, e `paused_manual` é o que se esquece. O predicado de
 * `idx_followup_enrollments_one_live` nasceu com três e a migration 0189 o
 * recriou com o quarto (`baseline.sql`, bloco da 0189). Uma lista de três aqui
 * NÃO daria erro: o cancelamento simplesmente não alcançaria o acompanhamento
 * pausado à mão, o insert bateria em 23505, e o lembrete não sairia — calado,
 * que é exatamente o desfecho que a decisão de dar prioridade ao lembrete existe
 * para impedir. Copiada do predicado em vigor, não da DDL original.
 *
 * E sim: isto CANCELA uma pausa que um humano pôs de propósito. É consequência
 * direta de o índice ser org-wide — enquanto um contato só puder ter um
 * acompanhamento vivo, "não cancelar a pausa" significa "não avisar o cliente da
 * hora marcada". Entre as duas, quem escolheu foi o dono do produto, e o
 * `cancel_reason` é o que permite achar essas linhas depois.
 */
export const STATUS_VIVOS_DO_ACOMPANHAMENTO = [
  "active",
  "waiting_reply",
  "paused_handoff",
  "paused_manual",
] as const;

/** Um pointer ativo armado por compromisso, já com a antecedência que ele pede. */
export interface CompromissoPointer {
  id: string;
  organization_id: string;
  active_version_id: string;
  minutes_before: number;
}

/** Um compromisso dentro da janela, já com o interruptor do tipo resolvido. */
export interface CompromissoNaJanela {
  appointment_id: string;
  contact_id: string;
  /** `false` quando o tipo tem o lembrete desligado — ou quando não há tipo. */
  lembrete_ligado: boolean;
}

/** DB surface do sweep — narrow por consumidor, mesma doutrina do `SilenceSweepDb`. */
export interface CompromissoSweepDb {
  /** Pointers ativos com `trigger_config.kind='appointment_upcoming'`, de TODAS as orgs. */
  loadActiveAppointmentPointers(): Promise<CompromissoPointer[]>;
  /**
   * Compromissos da org que começam entre `agoraIso` e `limiteIso`, ainda vivos,
   * com contato e sem lembrete enviado. Devolve TAMBÉM os de tipo desligado —
   * quem filtra é o sweep, para poder contá-los.
   */
  loadAppointmentsNaJanela(
    orgId: string,
    agoraIso: string,
    limiteIso: string,
  ): Promise<CompromissoNaJanela[]>;
  /** id do nó `trigger` do grafo pinado da version; `null` se não existir. */
  loadTriggerNodeId(orgId: string, versionId: string): Promise<string | null>;
  /**
   * Abre espaço no índice único para o lembrete deste contato entrar.
   *
   * ⚠️ AS DUAS PERGUNTAS SÃO UMA SÓ CHAMADA porque a resposta errada à primeira
   * destrói o trabalho da segunda. Se o vivo é DESTE MESMO pointer, ele É o
   * lembrete — já nasceu, talvez já tenha mandado a mensagem — e cancelá-lo para
   * reinserir seria o sweep se atropelando a cada tique.
   */
  prepararEspaco(
    orgId: string,
    contactId: string,
    pointerId: string,
    agoraIso: string,
  ): Promise<"ja_deste_fluxo" | "cancelou_outro" | "nada">;
  /**
   * Insere o enrollment nascendo no nó trigger; `inserted:false` = 23505 → skip.
   *
   * ⚠️ SEM `next_eval_at`, e a ausência é a regra da migration 0147. O
   * enrollment nasce VENCIDO — tem de ser reclamado no tique seguinte —, e quem
   * decide o "agora" é o `default now()` do BANCO, nunca o relógio do processo:
   * medido, o Postgres fica 17–34 ms atrás, e um "agora" de Node ainda é FUTURO
   * para o claim, que compara com `now()`. O lembrete perderia um tique inteiro
   * (até 60 s) numa mensagem que existe para chegar na hora certa.
   */
  insertEnrollment(input: {
    organization_id: string;
    pointer_id: string;
    version_id: string;
    contact_id: string;
    current_node_id: string;
    agent_id: string | null;
  }): Promise<{ inserted: boolean; id: string | null }>;
  /**
   * Grava QUAL compromisso abriu este acompanhamento.
   *
   * Proveniência sem coluna nova (DIRC — Referenciar antes de Duplicar), no
   * mesmo molde do `enrolled_by_stage_change` do gatilho de etapa: uma linha em
   * `followup_enrollment_events`. E ela não é enfeite de timeline — é o que o
   * resolvedor de variáveis LÊ para saber de que compromisso a mensagem fala.
   */
  registrarProveniencia(input: {
    organization_id: string;
    enrollment_id: string;
    node_id: string;
    appointment_id: string;
  }): Promise<void>;
  /** Fecha a idempotência: `reminder_sent_at = agora` neste compromisso. */
  markReminderSent(orgId: string, appointmentId: string, agoraIso: string): Promise<void>;
}

export interface CompromissoSweepSummary {
  pointers_scanned: number;
  pointers_gated_out: number;
  compromissos_na_janela: number;
  /** Na janela, mas o tipo tem o lembrete desligado (ou não há tipo). */
  sem_lembrete_ligado: number;
  /** Segundo (terceiro…) compromisso do MESMO contato no mesmo tique — fica para depois. */
  segundo_do_mesmo_contato: number;
  /** O lembrete deste contato já está em andamento neste fluxo. */
  ja_em_andamento: number;
  enrolled: number;
  /** Réguas de nutrição interrompidas para o lembrete passar. */
  acompanhamentos_cancelados: number;
  skipped_existing: number;
}

export interface CompromissoSweepDeps {
  db: CompromissoSweepDb;
  gateDb: FollowupGateDb;
  clock: () => Date;
}

export async function runAppointmentSweep(
  deps: CompromissoSweepDeps,
): Promise<CompromissoSweepSummary> {
  const { db, gateDb, clock } = deps;
  const summary: CompromissoSweepSummary = {
    pointers_scanned: 0,
    pointers_gated_out: 0,
    compromissos_na_janela: 0,
    sem_lembrete_ligado: 0,
    segundo_do_mesmo_contato: 0,
    ja_em_andamento: 0,
    enrolled: 0,
    acompanhamentos_cancelados: 0,
    skipped_existing: 0,
  };

  const pointers = await db.loadActiveAppointmentPointers();
  summary.pointers_scanned = pointers.length;

  // Memoiza a resolução do agente por pointer — mesma razão do silence-sweep:
  // nada impede dois pointers de compromisso na mesma org, e a query do gate já
  // é uma por org. `null` = gate-out (nenhum agente publicado arma o pointer).
  const agentCache = new Map<string, Promise<string | null>>();
  const resolveAgent = (orgId: string, pointerId: string): Promise<string | null> => {
    const key = `${orgId}:${pointerId}`;
    let hit = agentCache.get(key);
    if (!hit) {
      hit = resolveAgentForAutomaticTrigger(gateDb, orgId, pointerId);
      agentCache.set(key, hit);
    }
    return hit;
  };

  for (const pointer of pointers) {
    const agentId = await resolveAgent(pointer.organization_id, pointer.id);
    if (agentId === null) {
      summary.pointers_gated_out++;
      continue;
    }

    const triggerNodeId = await db.loadTriggerNodeId(
      pointer.organization_id,
      pointer.active_version_id,
    );
    if (!triggerNodeId) continue;

    const agora = clock();
    const agoraIso = agora.toISOString();
    const limiteIso = new Date(agora.getTime() + pointer.minutes_before * 60_000).toISOString();
    const naJanela = await db.loadAppointmentsNaJanela(
      pointer.organization_id,
      agoraIso,
      limiteIso,
    );
    summary.compromissos_na_janela += naJanela.length;

    // ⚠️ UM COMPROMISSO POR CONTATO POR TIQUE, e este `Set` é um conserto de
    // defeito medido, não zelo.
    //
    // O laço percorria a janela por COMPROMISSO. Com dois compromissos do mesmo
    // contato dentro dela (trivial com `minutes_before` de um dia: consulta às
    // 10h e retorno às 15h), a segunda volta cancelava o acompanhamento que a
    // PRIMEIRA acabara de criar — ele é "um acompanhamento vivo do contato" como
    // qualquer outro —, inseria outro no lugar e marcava o segundo compromisso.
    // Saldo: uma mensagem só, com a hora do compromisso errado, e o PRIMEIRO
    // compromisso com `reminder_sent_at` preenchido sem nunca ter sido lembrado.
    // Idempotência fechada sobre um envio que não aconteceu — o pior desfecho
    // possível, porque não há tique seguinte que o conserte.
    //
    // Como `naJanela` vem ordenado por `starts_at` crescente, o que fica é o
    // MAIS PRÓXIMO — o que o cliente precisa saber agora. O outro continua sem
    // marca e é alcançado num tique seguinte, quando este acompanhamento
    // terminar.
    const contatosDoTique = new Set<string>();

    for (const compromisso of naJanela) {
      if (!compromisso.lembrete_ligado) {
        summary.sem_lembrete_ligado++;
        continue;
      }
      if (contatosDoTique.has(compromisso.contact_id)) {
        summary.segundo_do_mesmo_contato++;
        continue;
      }
      contatosDoTique.add(compromisso.contact_id);

      // Abre espaço no índice único ANTES de tentar o insert. Ordem invertida
      // (tentar, ver 23505, cancelar, tentar de novo) custaria um insert
      // condenado por lembrete e deixaria o caminho feliz mais lento que o raro.
      const espaco = await db.prepararEspaco(
        pointer.organization_id,
        compromisso.contact_id,
        pointer.id,
        agoraIso,
      );
      if (espaco === "ja_deste_fluxo") {
        // O lembrete deste contato já está em andamento. Sair SEM marcar é o que
        // mantém o outro compromisso dele alcançável no tique seguinte.
        summary.ja_em_andamento++;
        continue;
      }
      if (espaco === "cancelou_outro") summary.acompanhamentos_cancelados++;

      const { inserted, id: enrollmentId } = await db.insertEnrollment({
        organization_id: pointer.organization_id,
        pointer_id: pointer.id,
        version_id: pointer.active_version_id,
        contact_id: compromisso.contact_id,
        current_node_id: triggerNodeId,
        agent_id: agentId,
      });

      if (!inserted) {
        // Sobrou concorrência: outro tick (ou outro pointer de compromisso na
        // mesma org) nasceu no intervalo. NÃO marca `reminder_sent_at` — quem
        // não enrollou não mandou, e a janela ainda tem minutos para tentar.
        summary.skipped_existing++;
        continue;
      }

      summary.enrolled++;

      // ⚠️ A PROVENIÊNCIA VEM ANTES DA MARCA, e a ordem é o conserto de um
      // defeito medido em auditoria.
      //
      // Sem ela, o texto da mensagem resolvia por "o próximo compromisso do
      // contato" — um palpite que acerta no caso de um compromisso só e erra
      // exatamente quando há dois: o acompanhamento do primeiro encerra no mesmo
      // tique, o segundo nasce no seguinte, e a frase dele cita o PRIMEIRO de
      // novo. O cliente recebia duas mensagens quase idênticas, com um minuto de
      // diferença, as duas com a mesma hora — e a hora do segundo compromisso
      // nunca era dita.
      //
      // Gravar antes de `markReminderSent` é o que impede o pior par: um
      // compromisso marcado como lembrado por um acompanhamento que não sabe
      // dizer de quem é. Se a gravação falhar, nada é marcado e o tique seguinte
      // refaz — o `idempotency_key` faz a repetição ser inócua.
      if (enrollmentId) {
        await db.registrarProveniencia({
          organization_id: pointer.organization_id,
          enrollment_id: enrollmentId,
          node_id: triggerNodeId,
          appointment_id: compromisso.appointment_id,
        });
      }

      await db.markReminderSent(pointer.organization_id, compromisso.appointment_id, agoraIso);
    }
  }

  return summary;
}

type TipoLinha = { reminder_enabled: boolean | null };
type TipoEmbed = TipoLinha | TipoLinha[] | null;

/**
 * O interruptor do tipo, aceitando as DUAS formas do embed.
 *
 * `event_type_id` é FK única para `calendar_event_types`, então o PostgREST
 * devolve objeto (ou `null`) — é o que o precedente de `silence-sweep.ts` supõe
 * para `contacts:contact_id(...)`, e a checagem do schema confirma que não há
 * segunda FK entre as tabelas. A tolerância ao array existe porque o custo dela
 * é uma linha e o custo de estar errado é TOTAL e MUDO: com array, o
 * `?.reminder_enabled` seria sempre `undefined`, nenhum compromisso passaria no
 * filtro e nenhum lembrete sairia — sem erro, sem contador, sem sintoma. É a
 * mesma defesa que `lib/ai/handoff/triggers.ts` já faz por escrito.
 *
 * Exportada para o teste: o adapter só é exercitável contra Postgres real
 * (`test:db`), e sem isto esta decisão ficaria sem prova nenhuma.
 */
export function tipoLigado(embed: TipoEmbed): boolean {
  const linha = Array.isArray(embed) ? embed[0] : embed;
  return linha?.reminder_enabled === true;
}

/** Production adapter: `CompromissoSweepDb` sobre o client service-role real. */
export function createSupabaseCompromissoSweepDb(admin: SupabaseClient): CompromissoSweepDb {
  return {
    async loadActiveAppointmentPointers() {
      const { data, error } = await admin
        .from("followup_flow_pointers")
        .select("id, organization_id, active_version_id, trigger_config")
        .eq("status", "active")
        .not("active_version_id", "is", null);
      if (error) throw new Error(error.message);

      const pointers: CompromissoPointer[] = [];
      for (const row of (data ?? []) as Array<{
        id: string;
        organization_id: string;
        active_version_id: string | null;
        trigger_config: unknown;
      }>) {
        if (!row.active_version_id) continue;
        const parsed = triggerConfigSchema.safeParse(row.trigger_config);
        if (!parsed.success || parsed.data.kind !== "appointment_upcoming") continue;
        pointers.push({
          id: row.id,
          organization_id: row.organization_id,
          active_version_id: row.active_version_id,
          minutes_before: parsed.data.params.minutes_before,
        });
      }
      return pointers;
    },

    async loadAppointmentsNaJanela(orgId, agoraIso, limiteIso) {
      // `calendar_appointments_org_vivos_idx` é `(organization_id, starts_at)
      // where status in ('pending','confirmed')` — esta consulta é exatamente a
      // forma dele, e por isso não há índice novo nesta entrega.
      //
      // O embed do tipo NÃO é `!inner`: um join filtrando dentro do banco
      // esconderia os compromissos de tipo desligado, que é justamente o número
      // que o sweep precisa contar para não ficar mudo.
      const { data, error } = await admin
        .from("calendar_appointments")
        .select("id, contact_id, calendar_event_types:event_type_id(reminder_enabled)")
        .eq("organization_id", orgId)
        .in("status", [...STATUS_VIVOS_DO_COMPROMISSO])
        .is("reminder_sent_at", null)
        .not("contact_id", "is", null)
        .gte("starts_at", agoraIso)
        .lte("starts_at", limiteIso)
        .order("starts_at", { ascending: true });
      if (error) throw new Error(error.message);

      type Row = { id: string; contact_id: string | null; calendar_event_types: TipoEmbed };
      const devidos: CompromissoNaJanela[] = [];
      for (const row of (data ?? []) as unknown as Row[]) {
        if (!row.contact_id) continue;
        devidos.push({
          appointment_id: row.id,
          contact_id: row.contact_id,
          lembrete_ligado: tipoLigado(row.calendar_event_types),
        });
      }
      return devidos;
    },

    async loadTriggerNodeId(orgId, versionId) {
      const { data, error } = await admin
        .from("followup_flow_versions")
        .select("graph")
        .eq("organization_id", orgId)
        .eq("id", versionId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      const graph = flowGraphSchema.parse(data.graph);
      return graph.nodes.find((n) => n.type === "trigger")?.id ?? null;
    },

    async prepararEspaco(orgId, contactId, pointerId, agoraIso) {
      // Primeiro a pergunta que impede o auto-atropelo: o vivo é o MEU?
      const { data: meu, error: meuErr } = await admin
        .from("followup_enrollments")
        .select("id")
        .eq("organization_id", orgId)
        .eq("contact_id", contactId)
        .eq("pointer_id", pointerId)
        .in("status", [...STATUS_VIVOS_DO_ACOMPANHAMENTO])
        .limit(1)
        .maybeSingle();
      if (meuErr) throw new Error(meuErr.message);
      if (meu) return "ja_deste_fluxo";

      // `neq("pointer_id")` é redundante depois da consulta acima e fica assim
      // de propósito: entre a leitura e o UPDATE cabe um tique concorrente, e
      // sem ele esse UPDATE cancelaria o lembrete que o outro tique acabou de
      // criar — de novo o auto-atropelo, agora por corrida.
      const { data, error } = await admin
        .from("followup_enrollments")
        .update({
          status: "cancelled",
          cancel_reason: CANCELADO_PELO_LEMBRETE,
          completed_at: agoraIso,
          next_eval_at: null,
          claimed_until: null,
          updated_at: agoraIso,
        })
        .eq("organization_id", orgId)
        .eq("contact_id", contactId)
        .neq("pointer_id", pointerId)
        .in("status", [...STATUS_VIVOS_DO_ACOMPANHAMENTO])
        .select("id, current_node_id");
      if (error) throw new Error(error.message);

      const cancelados = (data ?? []) as Array<{ id: string; current_node_id: string }>;
      // ⚠️ O CANCELAMENTO TEM DE DEIXAR LINHA NA TIMELINE, e é o mesmo contrato
      // dos outros três caminhos que cancelam um acompanhamento (rota manual,
      // caso fechado, reatividade). Sem o evento, o dossiê termina no vazio e o
      // cabeçalho mostra `lembrete_de_compromisso` cru — código, não frase. Este
      // é o único cancelamento que pode desfazer uma pausa posta por uma pessoa;
      // é o que mais precisa dizer por quê. `eventos-legiveis.ts` traduz.
      //
      // Sem audit por enrollment, como em `gatilho-caso.ts`: a varredura já
      // audita o agregado (`followup.appointment_sweep_run`), e uma linha por
      // cancelamento num cron de minuto em minuto é o ruído que o CLAUDE.md
      // proíbe. A timeline é o registro por caso.
      for (const alvo of cancelados) {
        const { error: evErr } = await admin.from("followup_enrollment_events").insert({
          organization_id: orgId,
          enrollment_id: alvo.id,
          node_id: alvo.current_node_id,
          event_type: "cancelled_by_appointment_reminder",
          payload: { cancel_reason: CANCELADO_PELO_LEMBRETE, pointer_do_lembrete: pointerId },
          idempotency_key: `lembrete-cancela:${alvo.id}`,
        });
        if (evErr && evErr.code !== "23505") throw new Error(evErr.message);
      }
      return cancelados.length > 0 ? "cancelou_outro" : "nada";
    },

    async insertEnrollment(input) {
      const { data, error } = await admin
        .from("followup_enrollments")
        .insert(input)
        .select("id")
        .single();
      if (error) {
        if (error.code === "23505") return { inserted: false, id: null };
        throw new Error(error.message);
      }
      return { inserted: true, id: (data?.id as string | undefined) ?? null };
    },

    async registrarProveniencia(input) {
      const { error } = await admin.from("followup_enrollment_events").insert({
        organization_id: input.organization_id,
        enrollment_id: input.enrollment_id,
        node_id: input.node_id,
        event_type: EVENTO_DE_PROVENIENCIA,
        payload: { appointment_id: input.appointment_id },
        idempotency_key: `lembrete-nasce:${input.enrollment_id}`,
      });
      if (error && error.code !== "23505") throw new Error(error.message);
    },

    async markReminderSent(orgId, appointmentId, agoraIso) {
      const { error } = await admin
        .from("calendar_appointments")
        .update({ reminder_sent_at: agoraIso })
        .eq("organization_id", orgId)
        .eq("id", appointmentId)
        .is("reminder_sent_at", null);
      if (error) throw new Error(error.message);
    },
  };
}
