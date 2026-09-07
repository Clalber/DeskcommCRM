/**
 * O MOTOR RESOLVE AS VARIÁVEIS ANTES DE ENFILEIRAR — e sem este arquivo, não.
 *
 * ═══ A lacuna que este teste fecha, medida em auditoria ═══
 *
 * `resolverTexto` é campo OPCIONAL de `TickDeps` (opcional de propósito: dezenas
 * de testes montam `deps` parciais porque exercitam o roteamento do grafo, não a
 * mensagem). A ligação em produção é uma linha no cron, e havia uma cerca para
 * ela — `followup-cron-liga-o-compromisso.test.ts`.
 *
 * Só que essa cerca prova que a LINHA EXISTE NA ROTA, não que o motor a USA.
 * Sabotagem do auditor: removido o bloco `if (payload.fixed_body &&
 * deps.resolverTexto)` de `engine.ts` inteiro → **455 testes verdes**. O corpo
 * entraria na fila com `{{agendamento.hora}}` literal, e é isso que chegaria ao
 * WhatsApp do cliente. Nenhum gate acusaria.
 *
 * Este arquivo mede o outro lado: dado um nó de ação com texto fixo, o
 * `fixed_body` do job enfileirado é o texto RESOLVIDO.
 */
import { describe, expect, it } from "vitest";

import { runFollowupTick, type FollowupJobRequest } from "@/lib/followup/engine";

const ORG = "11111111-1111-4111-8111-111111111111";
const AGORA = new Date("2026-09-04T12:00:00.000Z");

const GRAFO = {
  nodes: [
    { id: "n1", type: "action", label: "Lembrete", position: { x: 0, y: 0 },
      config: { mode: "text", body: "Sua reunião é às {{agendamento.hora}}." } },
    { id: "n2", type: "end", label: "Fim", position: { x: 100, y: 0 },
      config: { outcome: "custom" } },
  ],
  edges: [{ id: "e1", source: "n1", target: "n2", condition: { type: "always" } }],
};

const ENROLLMENT = {
  id: "22222222-2222-4222-8222-222222222222",
  organization_id: ORG,
  pointer_id: "33333333-3333-4333-8333-333333333333",
  version_id: "44444444-4444-4444-8444-444444444444",
  contact_id: "55555555-5555-4555-8555-555555555555",
  conversation_id: null,
  current_node_id: "n1",
  status: "active",
  next_eval_at: AGORA.toISOString(),
  claimed_until: null,
  attempts: 0,
  max_attempts: 3,
  last_error: null,
  steps_taken: 0,
  outcome: null,
  cancel_reason: null,
  started_at: AGORA.toISOString(),
  completed_at: null,
  updated_at: AGORA.toISOString(),
  timing_plan: null,
  agent_id: null,
};

function deps(resolverTexto?: (o: string, c: string, t: string) => Promise<string>) {
  const jobs: FollowupJobRequest[] = [];
  let entregou = false;
  return {
    jobs,
    deps: {
      db: {
        // Um claim só: o segundo tick do mesmo teste não tem nada a fazer.
        claimDueEnrollments: async () => (entregou ? [] : ((entregou = true), [ENROLLMENT])),
        loadFlowGraph: async () => GRAFO,
        loadLeadFacts: async () => ({ lead_stage: null, tags: [], contact_name: "Ana" }),
        loadEnrollmentEvents: async () => [],
        loadLastInboundBody: async () => null,
        insertEnrollmentEvent: async () => ({ inserted: true }),
        updateEnrollment: async () => {},
        loadFlowPointerName: async () => "Lembrete de reunião",
        insertDeadInboxItem: async () => {},
        persistirRespostaFollowup: async () => {},
      },
      clock: () => AGORA,
      enqueueJob: async (job: FollowupJobRequest) => {
        jobs.push(job);
      },
      ...(resolverTexto ? { resolverTexto } : {}),
    } as never,
  };
}

describe("o motor resolve o texto fixo antes de pôr na fila", () => {
  it("com resolvedor, o job carrega o texto PRONTO", async () => {
    const { jobs, deps: d } = deps(async (_org, _contato, texto) =>
      texto.replace("{{agendamento.hora}}", "14:00"),
    );

    await runFollowupTick(d);

    expect(jobs).toHaveLength(1);
    // ⚠️ A asserção que a sabotagem S8 do auditor atravessou: sem o bloco no
    // engine.ts, isto seria "Sua reunião é às {{agendamento.hora}}." — a chave
    // crua indo para o WhatsApp do cliente.
    expect(jobs[0]?.payload.fixed_body).toBe("Sua reunião é às 14:00.");
  });

  it("o resolvedor recebe a organização e o contato DO ENROLLMENT", async () => {
    const vistos: Array<{ org: string; contato: string }> = [];
    const { deps: d } = deps(async (org, contato, texto) => {
      vistos.push({ org, contato });
      return texto;
    });

    await runFollowupTick(d);

    // Resolver com a org errada num produto multi-tenant é vazamento, não bug de
    // texto: a hora de um compromisso de outra empresa.
    expect(vistos).toEqual([{ org: ORG, contato: ENROLLMENT.contact_id }]);
  });

  it("sem resolvedor, o corpo vai como está — o contrato de opcional", async () => {
    const { jobs, deps: d } = deps(undefined);

    await runFollowupTick(d);

    expect(jobs[0]?.payload.fixed_body).toBe("Sua reunião é às {{agendamento.hora}}.");
  });
});
