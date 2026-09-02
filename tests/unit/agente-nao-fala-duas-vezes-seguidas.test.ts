/**
 * O agente não pode mandar duas mensagens seguidas sem o cliente ter escrito.
 *
 * ─── A corrida, medida em produção (2026-09-02, 18h51) ──────────────────────
 *
 * O cliente mandou duas mensagens com 10 segundos entre elas:
 *
 *     18:50:44 [cliente] Blz
 *     18:50:54 [cliente] Preciso estruturar meu negócio mesmo
 *     18:51:08 [agente]  Combinado, Clalber. Até sexta, às 14h, com o Thiago.
 *     18:51:42 [agente]  Clalber, conferi por aqui: sua reunião está confirmada…
 *
 * A segunda mensagem do agente não responde a nada — ninguém escreveu entre uma
 * e outra.
 *
 * ─── Por que aconteceu ──────────────────────────────────────────────────────
 *
 * A coalescência do drain só pega carona em job `pending` com
 * `run_after > now()`. Com `INBOUND_DEBOUNCE_MS` de 3s, o job da PRIMEIRA
 * mensagem já tinha amadurecido quando a segunda chegou (10s depois) — e já
 * estava `running`. A consulta não achou nada e criou um segundo job.
 *
 * O primeiro turno leu o histórico completo, viu as duas mensagens e respondeu
 * as duas. O segundo rodou sem nada novo — e falou assim mesmo.
 *
 * ─── Por que a guarda é esta ────────────────────────────────────────────────
 *
 * "Coalescer também em job `running`" é o conserto óbvio e é PIOR: o turno em
 * voo pode já ter lido o histórico, e a mensagem nova ficaria sem resposta.
 * Silêncio é pior que repetição — a repetição incomoda, o silêncio perde o
 * cliente e não deixa rastro.
 *
 * A pergunta certa é decidível depois do fato: **a mensagem que abriu ESTE job
 * já foi respondida?** Se existe outbound mais novo que ela, o turno anterior já
 * a alcançou.
 *
 * O segundo caso é o controle na direção oposta, e é ele que impede o conserto
 * de virar mudez: cliente que escreve DEPOIS da resposta tem de ser atendido.
 */
import { describe, expect, it, vi } from "vitest";

const ORG = "11111111-1111-4111-8111-111111111111";
const CONVERSA = "22222222-2222-4222-8222-222222222222";
const CONTATO = "33333333-3333-4333-8333-333333333333";
const CANAL = "44444444-4444-4444-8444-444444444444";
const EVENTO = "55555555-5555-4555-8555-555555555555";
const MSG = "66666666-6666-4666-8666-666666666666";

/** O turno de verdade — se ele for chamado, a guarda deixou passar. */
const rodouOTurno = vi.fn(async () => undefined);

vi.mock("@/lib/agent-engine/agent/run-model-call", () => ({
  runModelCall: rodouOTurno,
}));

function jobFalso() {
  return {
    id: "job-1",
    organization_id: ORG,
    contact_id: CONTATO,
    kind: "inbound_turn",
    payload: {
      conversation_id: CONVERSA,
      contact_id: CONTATO,
      channel_session_id: CANAL,
      inbound_message_id: MSG,
      crm_event_id: EVENTO,
    },
  };
}

/**
 * Pool mínimo. `jaRespondida` é a PRIMEIRA consulta do handler; o que ela
 * devolve decide se o turno segue. Qualquer consulta seguinte significa que a
 * guarda deixou passar — e é isso que os casos medem.
 */
function poolFalso(jaRespondeu: boolean) {
  const consultas: string[] = [];
  return {
    consultas,
    pool: {
      query: async (sql: string) => {
        consultas.push(sql);
        if (/direction = 'outbound'/.test(sql)) return { rows: [{ ja: jaRespondeu }] };
        // Qualquer outra consulta: o handler seguiu adiante.
        return { rows: [] };
      },
    },
  };
}

describe("turno cuja mensagem já foi respondida é dispensado", () => {
  it("⚠️ existe outbound mais novo que a mensagem de origem → NÃO roda o turno", async () => {
    // O caso de produção: o job da segunda mensagem chega depois de o turno
    // anterior já ter respondido as duas.
    const { createInboundTurnHandler } = await import("@/lib/agent-engine/agent/inbound-turn");
    const { consultas, pool } = poolFalso(true);
    const avisos: { msg: string }[] = [];

    const handler = createInboundTurnHandler({
      log: {
        info: (msg: string) => avisos.push({ msg }),
        warn: () => undefined,
        error: () => undefined,
        debug: () => undefined,
      },
    } as never);

    await handler(jobFalso() as never, pool as never, { workerId: "w1" });

    // A guarda respondeu e nada mais foi consultado: o turno não começou.
    expect(
      consultas.length,
      `o turno seguiu adiante — consultas feitas: ${consultas.length}`,
    ).toBe(1);
    expect(avisos.some((a) => /dispensado/.test(a.msg)), "não registrou o motivo").toBe(true);
  });

  it("nada respondeu ainda → o turno ROLA normalmente", async () => {
    // ⚠️ O controle que impede o conserto de virar mudez. Sem ele, uma guarda
    // que recusasse SEMPRE passaria no caso acima — e o agente pararia de
    // responder, que é muito pior que falar duas vezes.
    const { createInboundTurnHandler } = await import("@/lib/agent-engine/agent/inbound-turn");
    const { consultas, pool } = poolFalso(false);

    const handler = createInboundTurnHandler({
      log: { info: () => undefined, warn: () => undefined, error: () => undefined, debug: () => undefined },
    } as never);

    // ⚠️ A SONDA, e por que é esta. Com `deps` de mentira, o turno de verdade
    // estoura assim que começa — então "passou da guarda" se prova pelo THROW,
    // não por contar consultas: a primeira versão contava, e o estouro
    // acontecia ANTES da segunda consulta, deixando o caso vermelho por
    // instrumento errado. Montar deps completas aqui exigiria banco, modelo e
    // registry — é o que os testes de integração fazem, não este.
    let estourou = false;
    try {
      await handler(jobFalso() as never, pool as never, { workerId: "w1" });
    } catch {
      estourou = true;
    }

    expect(
      estourou,
      "a guarda barrou um turno legítimo — o agente ficaria mudo, que é pior que repetir",
    ).toBe(true);
    // E a guarda foi de fato consultada antes de liberar.
    expect(consultas.length).toBeGreaterThanOrEqual(1);
  });
});
