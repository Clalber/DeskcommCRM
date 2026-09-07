import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  KIND_DE_COMPROMISSO,
  kindDoTrigger,
  motivoParaRecusarSegundoLembrete,
} from "@/lib/followup/gatilho-unico-de-compromisso";
import { descreveEvento } from "@/lib/followup/eventos-legiveis";

/**
 * AS QUATRO GUARDAS DO LEMBRETE QUE PASSAVAM POR TODOS OS GATES SE ALGUÉM AS
 * REMOVESSE.
 *
 * A auditoria independente sabotou os consertos um a um e mediu: quatro deles
 * — a recusa do segundo fluxo, o `reminder_sent_at = null` do remarcar, o
 * `aviso` no toast do publish e o rótulo do cancelamento na timeline — ficaram
 * VERDES com o código quebrado. São exatamente o modo de falha que este repo já
 * pagou caro: conserto sem cerca é conserto que a próxima refatoração desfaz em
 * silêncio.
 *
 * Duas das quatro dão teste de COMPORTAMENTO (a recusa e o rótulo). As outras
 * duas vivem dentro de um handler e de um hook que só se exercitam com Supabase
 * e React de verdade — para elas a cerca lê o fonte, que é grosseiro e é o que
 * há. O que se perde (um `if (false)` em volta passaria) é menor que o que se
 * ganha: hoje não há cerca nenhuma.
 */

const RAIZ = join(__dirname, "..", "..");

// ─── comportamento: a recusa do segundo fluxo ────────────────────────────

/** Dublê do PostgREST: guarda os filtros e devolve as linhas fixadas. */
function clienteFalso(linhas: Array<{ id: string; name: string; trigger_config: unknown }>) {
  const filtros: Record<string, unknown> = {};
  const chain = {
    select: () => chain,
    eq: (col: string, val: unknown) => {
      filtros[`eq:${col}`] = val;
      return chain;
    },
    neq: (col: string, val: unknown) => {
      filtros[`neq:${col}`] = val;
      return chain;
    },
    then: (resolve: (r: { data: unknown; error: null }) => void) =>
      resolve({ data: linhas, error: null }),
  };
  return { db: { from: () => chain } as never, filtros };
}

const ARMADO = { id: "outro", name: "Lembrete de reunião", trigger_config: { kind: KIND_DE_COMPROMISSO } };
const SILENCIO = { id: "terceiro", name: "Reativação", trigger_config: { kind: "silence" } };

describe("um fluxo armado por compromisso por organização", () => {
  it("recusa quando já existe outro, e a frase nomeia qual", async () => {
    const { db } = clienteFalso([SILENCIO, ARMADO]);
    const recusa = await motivoParaRecusarSegundoLembrete(db, "org-1", "eu");
    expect(recusa).toContain("Lembrete de reunião");
  });

  it("deixa passar quando só há gatilhos de outro tipo", async () => {
    const { db } = clienteFalso([SILENCIO]);
    expect(await motivoParaRecusarSegundoLembrete(db, "org-1", "eu")).toBeNull();
  });

  it("⚠️ o próprio fluxo NÃO conta — republicar não pode se recusar a si mesmo", async () => {
    // A sabotagem T7 do auditor: remover o `neq("id")` deixava o publish de um
    // fluxo já ativo recusar a si próprio, e nenhum teste reclamava.
    const { db, filtros } = clienteFalso([]);
    await motivoParaRecusarSegundoLembrete(db, "org-1", "eu");
    expect(filtros["neq:id"], "sem este filtro, republicar vira 422").toBe("eu");
    expect(filtros["eq:organization_id"], "consulta cross-tenant seria vazamento").toBe("org-1");
    expect(filtros["eq:status"], "fluxo desativado não segura o lugar").toBe("active");
  });

  it("jsonb de qualquer forma não derruba a leitura do kind", () => {
    expect(kindDoTrigger({ kind: KIND_DE_COMPROMISSO })).toBe(KIND_DE_COMPROMISSO);
    expect(kindDoTrigger(null)).toBe("manual");
    expect(kindDoTrigger({})).toBe("manual");
    expect(kindDoTrigger({ kind: 42 })).toBe("manual");
  });
});

// ─── comportamento: o cancelamento tem frase na timeline ──────────────────

describe("o cancelamento pelo lembrete é legível no dossiê", () => {
  it("não cai no «Passo registrado pelo motor» genérico", () => {
    // Sabotagem T10: sem o `case`, o dossiê mostrava o código cru.
    const lido = descreveEvento(
      {
        id: "ev-1",
        node_id: "n1",
        event_type: "cancelled_by_appointment_reminder",
        payload: { cancel_reason: "lembrete_de_compromisso" },
        created_at: "2026-09-05T12:00:00.000Z",
      },
      {},
      "pt",
    );
    expect(lido.titulo).not.toContain("Passo registrado");
    expect(lido.titulo.toLowerCase()).toContain("lembrete");
    expect(lido.detalhe).toBeTruthy();
  });
});

// ─── fonte: as duas que não se exercitam sem Supabase e React ─────────────

describe("remarcar devolve o lembrete", () => {
  const handler = readFileSync(
    join(RAIZ, "app", "api", "v1", "agenda", "agendamentos", "_handler.ts"),
    "utf8",
  );

  it("o UPDATE que muda starts_at também zera reminder_sent_at", () => {
    // Sabotagem T8: sem esta linha, quem remarca de segunda para sexta nunca
    // mais recebe lembrete — a marca de idempotência sobrevive à nova hora.
    expect(handler).toContain("mudanca.reminder_sent_at = null");
  });

  it("e ela está no MESMO bloco que grava a hora nova", () => {
    // Fora do `if (!mesmoHorario)` a linha zeraria a marca em qualquer PATCH,
    // inclusive num que só muda a nota — e o lembrete sairia duas vezes.
    const bloco = handler.slice(
      handler.indexOf("if (!mesmoHorario)"),
      handler.indexOf('transicao = "rescheduled"'),
    );
    expect(bloco).toContain("mudanca.reminder_sent_at = null");
  });
});

describe("o aviso do publish chega à tela", () => {
  const hook = readFileSync(join(RAIZ, "hooks", "followup", "useFollowupFlow.ts"), "utf8");

  it("o hook lê o aviso e não engole num success genérico", () => {
    // Sabotagem T9: sem isto, publicar um fluxo que não vai falar com ninguém
    // mostra «Fluxo publicado.» e mais nada.
    expect(hook).toContain("data?.aviso");
    expect(hook).toContain("toast.warning");
  });
});
