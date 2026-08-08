/**
 * DEPOIS QUE UM HUMANO ASSUME, O OPERADOR NÃO ESCREVE NO CRM DAQUELE LEAD.
 *
 * ## O defeito, medido em 2026-08-08 na main (`b9f2ca51`)
 *
 * `isLeadInHandoff` guardava TRÊS dos quatro handlers de turno da fila
 * (`inbound-turn.ts`, `followup-turn.ts` e, por herança de `runAgentTurn`,
 * `case-reply-turn.ts`) e **zero vezes** o `operator-turn.ts`. Sonda com controle
 * positivo: `grep -c isLeadInHandoff` devolvia 2 em cada irmão e 0 no Operador.
 *
 * A guarda tinha sido posta na FUNÇÃO de turno, e o Operador não é uma chamada
 * dela — é um job separado que ela enfileira. A garantia morava no lugar que o
 * Operador não atravessa.
 *
 * ## Por que o instante importa
 *
 * O handoff nasce DURANTE o turno do Conversador (a tool `request_human_handoff`)
 * ou depois dele (o "assumir eu" da tela), e o job do Operador é enfileirado no
 * fim daquele mesmo turno. Então checar no enfileiramento não resolveria: só o
 * INÍCIO DA EXECUÇÃO lê o estado que vale. É por isso que este teste roda o
 * handler de verdade em vez de afirmar que a linha existe no arquivo.
 *
 * ## Por que Postgres real
 *
 * `isLeadInHandoff` é uma query com duas fontes — `contacts.force_human` e
 * `conversations.bot_silenced_until > now()` — e um `exists` correlacionado. Em
 * unitário com dublê eu estaria testando a minha própria fiação; aqui o que
 * decide é o banco. Os dois braços do `or` têm caso próprio: consertar um e deixar
 * o outro passaria num teste que só cobrisse o primeiro.
 *
 * ## A guarda de vacuidade é o primeiro caso, de propósito
 *
 * Se a fixture não chegasse a produzir o aviso, os casos de handoff passariam por
 * não fazer nada — verde por ausência de medição. O caso 1 prova que este mesmo
 * cenário, SEM handoff, escreve na Central; só então "não escreveu" significa algo.
 */
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createOperatorTurnHandler } from "@/lib/agent-engine/agent/operator-turn";
import type { InboundTurnDeps } from "@/lib/agent-engine/agent/inbound-turn";
import type { JobRow } from "@/lib/agent-engine/queue/queue";
import type { Logger } from "@/lib/agent-engine/obs/logger";

const container = process.env.TEST_DB_CONTAINER;
if (!container) {
  throw new Error("TEST_DB_CONTAINER not set — rode via `pnpm test:db` (scripts/test-db.sh)");
}

const PORT = Number(process.env.TEST_DB_PORT ?? 54329);
const pool = new pg.Pool({
  connectionString: `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`,
  max: 2,
});

// Fixtures PRÓPRIAS, não as do `seedGov`: este arquivo escreve em `force_human` e
// `bot_silenced_until`, e o container é compartilhado entre arquivos de invariante
// (`fileParallelism: false`). Mexer no contato de outro teste faria a suíte falhar
// por ordem de execução — o tipo de vermelho que ninguém consegue ler.
const ORG = "0be7a70b-0000-4000-8000-000000000001";
const CONTACT = "0be7a70b-0000-4000-8000-000000000002";
const SESSION = "0be7a70b-0000-4000-8000-000000000003";
const CONV = "0be7a70b-0000-4000-8000-000000000004";
const AGENT = "0be7a70b-0000-4000-8000-000000000005";
const VERSION = "0be7a70b-0000-4000-8000-000000000006";

/** A declaração que o Conversador deixou: uma promessa, com prazo. */
const DECLARACAO = {
  intencoes: [{ o_que: "quer remarcar a consulta", evidencia: "pode ser na terça?" }],
  promessas: [{ o_que: "vou confirmar o horário e te retorno", prazo: "2026-08-11" }],
  nada_a_declarar: false,
};

function fakeLogger(): Logger & { entries: Array<{ level: string; msg: string; fields?: Record<string, unknown> }> } {
  const entries: Array<{ level: string; msg: string; fields?: Record<string, unknown> }> = [];
  return {
    entries,
    info: (msg, fields) => entries.push({ level: "info", msg, ...(fields !== undefined ? { fields } : {}) }),
    warn: (msg, fields) => entries.push({ level: "warn", msg, ...(fields !== undefined ? { fields } : {}) }),
    error: (msg, fields) => entries.push({ level: "error", msg, ...(fields !== undefined ? { fields } : {}) }),
  };
}

function fakeDeps(log: Logger): InboundTurnDeps {
  return {
    crmCfg: { supabase: createClient("http://127.0.0.1", "test-key") },
    llmCfg: {},
    knobs: {
      historyLimit: 20,
      maxContextTokens: 1_000,
      notesIndexMaxTokens: 500,
      maxSteps: 6,
      queuedRetryDelayMs: 1_000,
      breaker: {
        exactFailureWarn: 2,
        exactFailureBlock: 4,
        sameToolFailureWarn: 3,
        sameToolFailureHalt: 6,
        noProgressWarn: 2,
        noProgressBlock: 4,
      },
    },
    log,
  };
}

function job(): JobRow {
  return {
    id: "0be7a70b-0000-4000-8000-0000000000aa",
    organization_id: ORG,
    contact_id: CONTACT,
    kind: "operator_turn",
    source_event_id: null,
    payload: {
      conversation_id: CONV,
      origin_job_id: "0be7a70b-0000-4000-8000-0000000000bb",
      agent_id: AGENT,
    },
    status: "running",
    priority: 100,
    run_after: new Date(),
    attempts: 0,
    max_attempts: 5,
    last_error: null,
    locked_by: "test-worker",
    locked_at: new Date(),
    created_at: new Date(),
  };
}

async function avisosAbertos(): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(
    `select count(*)::text as n from agent_inbox_items
      where organization_id = $1 and kind = 'promise_unfulfilled'`,
    [ORG],
  );
  return Number(rows[0]?.n ?? "0");
}

async function rodarOperador(): Promise<ReturnType<typeof fakeLogger>> {
  const log = fakeLogger();
  await createOperatorTurnHandler(fakeDeps(log))(job(), pool, { workerId: "test-worker" });
  return log;
}

beforeAll(async () => {
  await pool.query(
    `insert into organizations (id, slug, legal_name, display_name)
     values ($1, 'org-operador-handoff', 'Org Handoff LTDA', 'Org Handoff')
     on conflict (id) do nothing`,
    [ORG],
  );
  await pool.query(
    `insert into channel_sessions (id, organization_id, waha_session_name, status, webhook_secret_encrypted)
     values ($1, $2, 'operador-handoff-session', 'WORKING', '\\x00'::bytea)
     on conflict (id) do nothing`,
    [SESSION, ORG],
  );
  await pool.query(
    `insert into contacts (id, organization_id, name, phone_number)
     values ($1, $2, 'Lead do Handoff', '+5511900000912') on conflict (id) do nothing`,
    [CONTACT, ORG],
  );
  await pool.query(
    `insert into conversations (id, organization_id, contact_id, channel_session_id, status, is_group)
     values ($1, $2, $3, $4, 'open', false) on conflict (id) do nothing`,
    [CONV, ORG, CONTACT, SESSION],
  );
  await pool.query(
    `insert into ai_agents (id, organization_id, name, system_prompt)
     values ($1, $2, 'Agente do handoff', 'system') on conflict (id) do nothing`,
    [AGENT, ORG],
  );
  // `operator_enabled = true` e `operator_tool_ids` no default (vazio): o papel
  // roda e não chama modelo nenhum — é o caminho em que o aviso de promessa é o
  // único efeito, o que torna a asserção sobre ele limpa e sem LLM.
  await pool.query(
    `insert into ai_agent_versions
       (id, organization_id, agent_id, version_number, system_prompt, provider, model,
        channel_session_id, status, operator_enabled)
     values ($1, $2, $3, 1, 'system', 'anthropic', 'claude-sonnet-4-6', $4, 'published', true)
     on conflict (id) do nothing`,
    [VERSION, ORG, AGENT, SESSION],
  );
  await pool.query(`update ai_agents set published_version_id = $1 where id = $2`, [VERSION, AGENT]);
  await pool.query(
    `insert into lead_checkpoints (organization_id, contact_id, job_id, rolling_summary, declaracao)
     values ($1, $2, null, 'quer remarcar', $3::jsonb)`,
    [ORG, CONTACT, JSON.stringify(DECLARACAO)],
  );

  // Controle positivo do pool: no banco errado as contagens viriam zeradas e
  // pareceriam medição.
  const { rows } = await pool.query<{ n: string }>(
    `select count(*)::text as n from lead_checkpoints where organization_id = $1 and declaracao is not null`,
    [ORG],
  );
  if (rows[0]?.n !== "1") throw new Error(`fixture não chegou ao banco da porta ${PORT}`);
});

beforeEach(async () => {
  await pool.query(`delete from agent_inbox_items where organization_id = $1`, [ORG]);
  await pool.query(`update contacts set force_human = false where id = $1`, [CONTACT]);
  await pool.query(`update conversations set bot_silenced_until = null where id = $1`, [CONV]);
});

afterAll(async () => {
  await pool.query("delete from organizations where id = $1", [ORG]);
  await pool.end();
});

describe("o Operador respeita o humano que assumiu", () => {
  it("GUARDA DE VACUIDADE — sem handoff, este mesmo cenário escreve na Central", async () => {
    // Sem este caso, os dois abaixo passariam por a fixture não fazer nada.
    const log = await rodarOperador();
    expect(await avisosAbertos(), "a fixture não chegou a produzir o aviso — os casos de handoff abaixo não medem nada").toBe(1);
    expect(log.entries.some((e) => e.msg.includes("operador rodou"))).toBe(true);
  });

  it("com force_human no contato, não escreve nada e diz por quê", async () => {
    await pool.query(`update contacts set force_human = true where id = $1`, [CONTACT]);

    const log = await rodarOperador();

    expect(await avisosAbertos(), "o Operador escreveu na Central depois de um humano assumir").toBe(0);
    const pulou = log.entries.find((e) => e.fields?.desfecho === "handoff_humano");
    expect(pulou, "pulou sem registrar o motivo — return mudo").toBeTruthy();
    // Não basta não agir: o caminho não pode nem ter chegado a rodar o papel.
    expect(log.entries.some((e) => e.msg.includes("operador rodou"))).toBe(false);
  });

  it("com a conversa silenciada (bot_silenced_until no futuro), também não escreve", async () => {
    // O outro braço do `or` de isLeadInHandoff. Cobrir só o force_human deixaria
    // passar um conserto que checasse uma fonte e esquecesse a outra.
    await pool.query(
      `update conversations set bot_silenced_until = now() + interval '1 hour' where id = $1`,
      [CONV],
    );

    const log = await rodarOperador();

    expect(await avisosAbertos()).toBe(0);
    expect(log.entries.some((e) => e.fields?.desfecho === "handoff_humano")).toBe(true);
  });

  it("silêncio VENCIDO não é handoff — o papel volta a operar sozinho", async () => {
    // A direção oposta importa: uma guarda que lesse `bot_silenced_until is not
    // null` em vez de `> now()` silenciaria o Operador para sempre depois do
    // primeiro handoff resolvido, e o funil pararia sem ninguém ver.
    await pool.query(
      `update conversations set bot_silenced_until = now() - interval '1 hour' where id = $1`,
      [CONV],
    );

    await rodarOperador();

    expect(await avisosAbertos(), "handoff vencido continuou barrando o papel").toBe(1);
  });
});
