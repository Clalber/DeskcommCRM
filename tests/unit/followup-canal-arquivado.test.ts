/**
 * O follow-up diante de um canal EXCLUÍDO — e diante de um banco que não sabe o
 * que é canal excluído.
 *
 * Duas mudanças entraram no `followup_turn` sem nenhuma guarda, e as duas mudam
 * DESFECHO de worker (o lugar onde defeito não aparece na tela, aparece em lead
 * sem resposta):
 *
 *  1. canal arquivado agora manda o job para dead-letter ANTES do turno. O envio
 *     seria recusado lá na frente de qualquer jeito, mas o turno inteiro —
 *     chamada de modelo inclusive — já teria sido pago para produzir um texto que
 *     não sai, e a fila retentaria contra o vazio.
 *  2. a coluna é lida por `to_jsonb(cs) ->> 'archived_at'`, e não por
 *     `cs.archived_at`, porque num clone que subiu o código sem a migration 0100
 *     a referência direta derruba a consulta com 42703 — ou seja, TODO follow-up
 *     da instalação, em silêncio. Um "cleanup" bem-intencionado dessa linha é
 *     exatamente o tipo de mudança que passa em revisão.
 *
 * O dublê do pool modela a regra do Postgres que sustenta a escolha: referência
 * direta a coluna inexistente é erro (42703); `to_jsonb` de uma linha sem a chave
 * devolve NULL. É por isso que a segunda garantia é comportamental, e não um
 * teste de texto: quem trocar a expressão vê a consulta explodir.
 */
import { describe, expect, it, vi } from "vitest";

import type * as InboundTurnModule from "@/lib/agent-engine/agent/inbound-turn";
import type { JobRow } from "@/lib/agent-engine/queue/queue";

const runAgentTurn = vi.fn(async () => undefined);

// Só `runAgentTurn` é dublado: o resto do módulo (JobSettledError, ritualBlocks)
// continua real, e é dele que o handler depende para chegar até a guarda.
vi.mock("@/lib/agent-engine/agent/inbound-turn", async (original) => {
  const real = await original<typeof InboundTurnModule>();
  return { ...real, runAgentTurn };
});

const ORG = "org-1";
const LEAD = "lead-1";
const CONVERSA = "conversa-1";
const CANAL = "canal-1";

function job(over: Partial<JobRow> = {}): JobRow {
  return {
    id: "job-1",
    organization_id: ORG,
    contact_id: LEAD,
    kind: "followup_turn",
    source_event_id: null,
    payload: {},
    status: "running",
    priority: 0,
    run_after: new Date(),
    attempts: 1,
    max_attempts: 3,
    last_error: null,
    locked_by: "w1",
    locked_at: new Date(),
    created_at: new Date(),
    ...over,
  } as JobRow;
}

interface PoolOpts {
  archivedAt?: string | null;
  /** Clone sem a migration 0100: a coluna simplesmente não existe na tabela. */
  semColuna?: boolean;
}

/** Pool que responde como o Postgres responderia, inclusive quando erra. */
function fakePool(opts: PoolOpts = {}) {
  const consultas: string[] = [];
  const query = vi.fn(async (sql: string) => {
    consultas.push(sql);
    // Regra do Postgres: referência DIRETA a coluna inexistente é 42703. A
    // expressão `to_jsonb(cs) ->> 'archived_at'` não referencia coluna nenhuma —
    // lê uma chave de um json, e chave ausente é NULL.
    if (opts.semColuna === true && /\bcs\.archived_at\b/.test(sql)) {
      throw Object.assign(new Error('column cs.archived_at does not exist'), { code: "42703" });
    }
    return {
      rows: [
        {
          id: CONVERSA,
          channel_session_id: CANAL,
          channel_archived_at: opts.semColuna === true ? null : (opts.archivedAt ?? null),
        },
      ],
    };
  });
  return { pool: { query } as never, query, consultas };
}

const ctx = { workerId: "w1" };

async function handler() {
  const { createFollowupTurnHandler } = await import("@/lib/agent-engine/agent/followup-turn");
  return createFollowupTurnHandler({} as never);
}

describe("followup_turn — canal arquivado", () => {
  it("⭐ canal EXCLUÍDO: o job morre com o motivo escrito, sem pagar o turno de modelo", async () => {
    runAgentTurn.mockClear();
    const { pool } = fakePool({ archivedAt: "2026-08-01T10:00:00.000Z" });
    const run = await handler();

    await expect(run(job(), pool, ctx)).rejects.toThrow(/canal arquivado/i);
    expect(runAgentTurn).not.toHaveBeenCalled();
  });

  it("canal ATIVO: o turno acontece (a guarda não matou o caminho bom)", async () => {
    runAgentTurn.mockClear();
    const { pool } = fakePool({ archivedAt: null });
    const run = await handler();

    await run(job(), pool, ctx);
    expect(runAgentTurn).toHaveBeenCalledTimes(1);
  });

  /**
   * ⭐ A guarda da tolerância. Se alguém "limpar" a expressão para
   * `cs.archived_at`, o clone sem a migration para de rodar follow-up inteiro —
   * e não com erro visível na tela, com job falhando num worker.
   */
  it("clone sem a migration 0100: o follow-up roda igual, a consulta não explode", async () => {
    runAgentTurn.mockClear();
    const { pool, consultas } = fakePool({ semColuna: true });
    const run = await handler();

    await run(job(), pool, ctx);
    expect(runAgentTurn).toHaveBeenCalledTimes(1);
    // Não-vacuidade: a consulta que rodou é mesmo a que resolve a conversa.
    expect(consultas[0]).toMatch(/from conversations/);
  });

  it("contato sem conversa/número: dead-letter, não turno contra o vazio", async () => {
    runAgentTurn.mockClear();
    const { pool, query } = fakePool();
    query.mockResolvedValueOnce({ rows: [] });
    const run = await handler();

    await expect(run(job(), pool, ctx)).rejects.toThrow(/impossível retomar o contato/i);
    expect(runAgentTurn).not.toHaveBeenCalled();
  });
});
