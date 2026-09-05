import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CANCELADO_PELO_LEMBRETE,
  STATUS_VIVOS_DO_ACOMPANHAMENTO,
  runAppointmentSweep,
  tipoLigado,
  type CompromissoNaJanela,
  type CompromissoPointer,
  type CompromissoSweepDb,
} from "./gatilho-compromisso";
import type { FollowupGateDb } from "./agent-followup-gate";

const ORG = "11111111-1111-1111-1111-111111111111";
const POINTER = "22222222-2222-2222-2222-222222222222";
const VERSION = "33333333-3333-3333-3333-333333333333";
const AGENTE = "44444444-4444-4444-4444-444444444444";
const AGORA = new Date("2026-09-04T12:00:00.000Z");

const pointerPadrao: CompromissoPointer = {
  id: POINTER,
  organization_id: ORG,
  active_version_id: VERSION,
  minutes_before: 60,
};

/** Gate que arma o pointer. `pointerIds: []` = nenhum agente publicado o arma. */
function gate(pointerIds: string[] = [POINTER]): FollowupGateDb {
  return {
    async loadEnabledPublishedFollowupAgents() {
      return [{ agentId: AGENTE, pointerIds }];
    },
  };
}

interface Registro {
  janelas: Array<{ agoraIso: string; limiteIso: string }>;
  enrollments: Array<{ contact_id: string; agent_id: string | null; campos: string[] }>;
  cancelados: string[];
  marcados: string[];
  /** A proveniência gravada: qual compromisso abriu qual acompanhamento. */
  proveniencias: Array<{ enrollment_id: string; appointment_id: string; node_id: string }>;
}

function fakeDb(
  compromissos: CompromissoNaJanela[],
  opcoes?: {
    pointers?: CompromissoPointer[];
    /** Contatos com acompanhamento vivo de OUTRO fluxo — o lembrete cancela. */
    comAcompanhamentoVivo?: string[];
    /** Contatos cujo lembrete DESTE fluxo já está em andamento. */
    lembreteEmAndamento?: string[];
    /** Contatos cujo insert bate no índice único mesmo depois do cancelamento. */
    insertColide?: string[];
    triggerNodeId?: string | null;
  },
): { db: CompromissoSweepDb; registro: Registro } {
  const registro: Registro = {
    janelas: [],
    enrollments: [],
    cancelados: [],
    marcados: [],
    proveniencias: [],
  };
  let proximoId = 0;
  const db: CompromissoSweepDb = {
    async loadActiveAppointmentPointers() {
      return opcoes?.pointers ?? [pointerPadrao];
    },
    async loadAppointmentsNaJanela(_orgId, agoraIso, limiteIso) {
      registro.janelas.push({ agoraIso, limiteIso });
      return compromissos;
    },
    async loadTriggerNodeId() {
      return opcoes?.triggerNodeId === undefined ? "no-trigger" : opcoes.triggerNodeId;
    },
    async prepararEspaco(_orgId, contactId) {
      if ((opcoes?.lembreteEmAndamento ?? []).includes(contactId)) return "ja_deste_fluxo";
      if ((opcoes?.comAcompanhamentoVivo ?? []).includes(contactId)) {
        registro.cancelados.push(contactId);
        return "cancelou_outro";
      }
      return "nada";
    },
    async insertEnrollment(input) {
      if ((opcoes?.insertColide ?? []).includes(input.contact_id)) {
        return { inserted: false, id: null };
      }
      registro.enrollments.push({
        contact_id: input.contact_id,
        agent_id: input.agent_id,
        campos: Object.keys(input).sort(),
      });
      return { inserted: true, id: `enr-${++proximoId}` };
    },
    async registrarProveniencia(input) {
      registro.proveniencias.push({
        enrollment_id: input.enrollment_id,
        appointment_id: input.appointment_id,
        node_id: input.node_id,
      });
    },
    async markReminderSent(_orgId, appointmentId) {
      registro.marcados.push(appointmentId);
    },
  };
  return { db, registro };
}

const compromisso = (
  id: string,
  contato: string,
  lembrete_ligado = true,
): CompromissoNaJanela => ({ appointment_id: id, contact_id: contato, lembrete_ligado });

describe("runAppointmentSweep", () => {
  it("enrolla o contato e fecha a idempotência marcando o compromisso", async () => {
    const { db, registro } = fakeDb([compromisso("ap-1", "contato-1")]);

    const resumo = await runAppointmentSweep({ db, gateDb: gate(), clock: () => AGORA });

    expect(resumo.enrolled).toBe(1);
    expect(registro.enrollments).toHaveLength(1);
    expect(registro.enrollments[0]).toMatchObject({ contact_id: "contato-1", agent_id: AGENTE });
    expect(registro.marcados).toEqual(["ap-1"]);
  });

  it("⚠️ o insert NÃO carrega next_eval_at — quem decide o «agora» é o banco (0147)", () => {
    // Passar o relógio do PROCESSO aqui faria o enrollment nascer 17–34 ms no
    // futuro para o claim, que compara com `now()` do Postgres: ele perderia o
    // tique seguinte e o lembrete sairia até 60 s depois. Numa mensagem que
    // existe para chegar na hora, um tique inteiro é o defeito.
    //
    // O teste é sobre o CONJUNTO de campos, não sobre o valor: um `next_eval_at`
    // que voltasse a ser enviado — com qualquer valor — derruba isto.
    const { db, registro } = fakeDb([compromisso("ap-1", "contato-1")]);
    return runAppointmentSweep({ db, gateDb: gate(), clock: () => AGORA }).then(() => {
      expect(registro.enrollments[0]?.campos).toEqual([
        "agent_id",
        "contact_id",
        "current_node_id",
        "organization_id",
        "pointer_id",
        "version_id",
      ]);
    });
  });

  it("a janela vai de agora até agora + a antecedência do fluxo", async () => {
    const { db, registro } = fakeDb([]);

    await runAppointmentSweep({ db, gateDb: gate(), clock: () => AGORA });

    // 12:00 + 60 min. O limite de BAIXO ser `agora` é o que impede o lembrete
    // de sair depois de a reunião ter começado.
    expect(registro.janelas).toEqual([
      { agoraIso: "2026-09-04T12:00:00.000Z", limiteIso: "2026-09-04T13:00:00.000Z" },
    ]);
  });

  it("tipo com o lembrete DESLIGADO não vira mensagem — e o número aparece no resumo", async () => {
    const { db, registro } = fakeDb([
      compromisso("ap-1", "contato-1", false),
      compromisso("ap-2", "contato-2", true),
    ]);

    const resumo = await runAppointmentSweep({ db, gateDb: gate(), clock: () => AGORA });

    expect(resumo.sem_lembrete_ligado).toBe(1);
    expect(resumo.enrolled).toBe(1);
    expect(registro.enrollments.map((e) => e.contact_id)).toEqual(["contato-2"]);
    // O desligado não é marcado: se o operador ligar o tipo antes da hora, o
    // lembrete daquele compromisso ainda sai.
    expect(registro.marcados).toEqual(["ap-2"]);
  });

  it("o lembrete tem prioridade: cancela o acompanhamento vivo antes de entrar", async () => {
    const { db, registro } = fakeDb([compromisso("ap-1", "contato-1")], {
      comAcompanhamentoVivo: ["contato-1"],
    });

    const resumo = await runAppointmentSweep({ db, gateDb: gate(), clock: () => AGORA });

    expect(resumo.acompanhamentos_cancelados).toBe(1);
    expect(registro.cancelados).toEqual(["contato-1"]);
    expect(resumo.enrolled).toBe(1);
  });

  it("insert que ainda colide NÃO marca o compromisso — a janela continua tentando", async () => {
    const { db, registro } = fakeDb([compromisso("ap-1", "contato-1")], {
      insertColide: ["contato-1"],
    });

    const resumo = await runAppointmentSweep({ db, gateDb: gate(), clock: () => AGORA });

    expect(resumo.skipped_existing).toBe(1);
    expect(resumo.enrolled).toBe(0);
    // ⚠️ O ponto do teste. Marcar aqui trocaria "mandou duas vezes" por "nunca
    // mandou": `reminder_sent_at` preenchido tira o compromisso da consulta
    // para sempre, e ninguém receberia o lembrete.
    expect(registro.marcados).toEqual([]);
  });

  it("⚠️ grava QUAL compromisso abriu o acompanhamento, antes de marcar", async () => {
    // Sem esta linha o texto da mensagem volta a ser palpite ("o próximo
    // compromisso do contato"), que erra justamente quando há dois: o cliente
    // recebe duas mensagens quase iguais, as duas com a hora do primeiro.
    const { db, registro } = fakeDb([compromisso("ap-1", "contato-1")]);

    await runAppointmentSweep({ db, gateDb: gate(), clock: () => AGORA });

    expect(registro.proveniencias).toEqual([
      { enrollment_id: "enr-1", appointment_id: "ap-1", node_id: "no-trigger" },
    ]);
  });

  it("insert que colide não grava proveniência órfã", async () => {
    const { db, registro } = fakeDb([compromisso("ap-1", "contato-1")], {
      insertColide: ["contato-1"],
    });

    await runAppointmentSweep({ db, gateDb: gate(), clock: () => AGORA });

    expect(registro.proveniencias).toEqual([]);
  });

  it("⚠️ dois compromissos do MESMO contato: o sweep não se atropela", async () => {
    // O defeito que este teste fixa (achado em auditoria): o laço percorria por
    // COMPROMISSO, então a segunda volta cancelava o acompanhamento que a
    // primeira acabara de criar e marcava o segundo compromisso. Saldo: uma
    // mensagem só, com a hora errada, e o PRIMEIRO compromisso com
    // `reminder_sent_at` preenchido sem nunca ter sido lembrado — idempotência
    // fechada sobre um envio que não aconteceu.
    //
    // `naJanela` chega ordenado por `starts_at`: fica o mais próximo.
    const { db, registro } = fakeDb([
      compromisso("ap-10h", "contato-1"),
      compromisso("ap-15h", "contato-1"),
    ]);

    const resumo = await runAppointmentSweep({ db, gateDb: gate(), clock: () => AGORA });

    expect(resumo.enrolled).toBe(1);
    expect(resumo.segundo_do_mesmo_contato).toBe(1);
    // Ninguém foi cancelado: não havia acompanhamento de outro fluxo.
    expect(registro.cancelados).toEqual([]);
    // E, sobretudo: o das 15h NÃO foi marcado. Marcá-lo o tiraria da consulta
    // para sempre, e ele nunca seria lembrado.
    expect(registro.marcados).toEqual(["ap-10h"]);
  });

  it("lembrete já em andamento neste fluxo: não reinsere e NÃO marca", async () => {
    // O tique seguinte encontra o outro compromisso do mesmo contato. Cancelar o
    // lembrete vivo para recriá-lo seria o sweep se atropelando de minuto em
    // minuto; marcar sem enrollar perderia o compromisso.
    const { db, registro } = fakeDb([compromisso("ap-15h", "contato-1")], {
      lembreteEmAndamento: ["contato-1"],
    });

    const resumo = await runAppointmentSweep({ db, gateDb: gate(), clock: () => AGORA });

    expect(resumo.ja_em_andamento).toBe(1);
    expect(resumo.enrolled).toBe(0);
    expect(registro.cancelados).toEqual([]);
    expect(registro.marcados).toEqual([]);
  });

  it("contatos diferentes na mesma janela recebem cada um o seu", async () => {
    // Controle do teste acima: a regra é POR CONTATO, não "um por tique".
    const { db, registro } = fakeDb([
      compromisso("ap-1", "contato-1"),
      compromisso("ap-2", "contato-2"),
    ]);

    const resumo = await runAppointmentSweep({ db, gateDb: gate(), clock: () => AGORA });

    expect(resumo.enrolled).toBe(2);
    expect(resumo.segundo_do_mesmo_contato).toBe(0);
    expect(registro.marcados).toEqual(["ap-1", "ap-2"]);
  });

  it("pointer que nenhum agente publicado arma não enrolla ninguém", async () => {
    const { db, registro } = fakeDb([compromisso("ap-1", "contato-1")]);

    const resumo = await runAppointmentSweep({ db, gateDb: gate([]), clock: () => AGORA });

    expect(resumo.pointers_gated_out).toBe(1);
    expect(resumo.enrolled).toBe(0);
    expect(registro.enrollments).toEqual([]);
    // Nem chega a olhar a agenda: gate-out é antes da consulta.
    expect(registro.janelas).toEqual([]);
  });

  it("versão sem nó de gatilho não enrolla — e não marca nada", async () => {
    const { db, registro } = fakeDb([compromisso("ap-1", "contato-1")], { triggerNodeId: null });

    const resumo = await runAppointmentSweep({ db, gateDb: gate(), clock: () => AGORA });

    expect(resumo.enrolled).toBe(0);
    expect(registro.marcados).toEqual([]);
  });

  it("o motivo do cancelamento é constante compartilhada, não literal solto", () => {
    // Cerca barata contra o defeito clássico: o sweep grava um literal, a fila
    // procura outro, e o «por que este acompanhamento morreu» some da tela.
    expect(CANCELADO_PELO_LEMBRETE).toBe("lembrete_de_compromisso");
  });
});

describe("tipoLigado — o embed do tipo, nas duas formas", () => {
  // O adapter só roda contra Postgres real, então esta é a única prova possível
  // aqui da decisão que, se estiver errada, não deixa NENHUM lembrete sair.
  it("objeto (a forma que o PostgREST devolve para FK única)", () => {
    expect(tipoLigado({ reminder_enabled: true })).toBe(true);
    expect(tipoLigado({ reminder_enabled: false })).toBe(false);
    expect(tipoLigado({ reminder_enabled: null })).toBe(false);
  });
  it("array de um (a forma que quebraria tudo em silêncio)", () => {
    expect(tipoLigado([{ reminder_enabled: true }])).toBe(true);
    expect(tipoLigado([{ reminder_enabled: false }])).toBe(false);
  });
  it("compromisso sem tipo nunca lembra", () => {
    expect(tipoLigado(null)).toBe(false);
    expect(tipoLigado([])).toBe(false);
  });
});

describe("a lista de estados vivos acompanha o índice do banco", () => {
  /**
   * ⚠️ ESTE É O TESTE QUE PEGA O DEFEITO QUE JÁ ESCAPOU UMA VEZ NESTA ENTREGA.
   *
   * `cancelLiveEnrollment` precisa alcançar EXATAMENTE os estados que
   * `idx_followup_enrollments_one_live` considera ocupados. Uma lista menor não
   * quebra nada — não há erro, não há teste vermelho: o cancelamento não alcança
   * a linha, o insert bate em 23505, e o lembrete não sai. Calado.
   *
   * O predicado já mudou uma vez (a 0189 acrescentou `paused_manual` ao que
   * nasceu com três), e a primeira versão deste arquivo copiou a lista ANTIGA.
   * Por isso a comparação é contra o `baseline.sql` — que é o que o self-hoster
   * aplica — e contra a ÚLTIMA definição do índice, não a primeira: o baseline
   * é dump + apêndice, e a definição em vigor é sempre a de baixo.
   */
  const baseline = readFileSync(
    join(__dirname, "..", "..", "supabase", "baseline.sql"),
    "utf8",
  );

  function predicadoEmVigor(): string[] {
    const criacoes = [
      ...baseline.matchAll(
        /create unique index if not exists idx_followup_enrollments_one_live[\s\S]*?where status in \(([^)]*)\)/g,
      ),
    ];
    const predicado = criacoes.at(-1)?.[1];
    if (!predicado) throw new Error("índice idx_followup_enrollments_one_live não achado no baseline");
    return [...predicado.matchAll(/'([a-z_]+)'/g)].flatMap((m) => (m[1] ? [m[1]] : [])).sort();
  }

  it("cobre os mesmos estados do predicado, sem sobrar nem faltar", () => {
    expect([...STATUS_VIVOS_DO_ACOMPANHAMENTO].sort()).toEqual(predicadoEmVigor());
  });

  it("controle da sonda: ela realmente leu quatro estados do baseline", () => {
    // Sem isto, um regex que não casasse nada devolveria [] e o teste acima
    // passaria comparando vazio com vazio no dia em que a constante esvaziasse.
    expect(predicadoEmVigor()).toHaveLength(4);
  });
});
