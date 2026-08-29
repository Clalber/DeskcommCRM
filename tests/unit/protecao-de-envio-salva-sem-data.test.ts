/**
 * A tela de Proteção de envio salva com a data do número EM BRANCO.
 *
 * ─── O defeito, encontrado em produção ──────────────────────────────────────
 *
 * O operador abriu Conexões → Proteção de envio, ajustou a janela e salvou sem
 * preencher "número em uso desde". A tela devolveu **"Falha ao salvar os
 * knobs."** — uma frase que não menciona data.
 *
 * A causa: `channel_knobs.number_activated_at` é a ÚNICA coluna da tabela com
 * `not null`, e tem `default now()`. A tela oferece a data como opcional e o
 * próprio texto de ajuda promete que deixar em branco faz o número ser "tratado
 * como recém-criado". Só que a rota mandava `null` EXPLÍCITO — e null explícito
 * anula o default. O insert morria com `23502`.
 *
 * ─── Por que ficou invisível ────────────────────────────────────────────────
 *
 * A rota descartava o erro do banco e devolvia texto fixo. Sem o `upErr.message`
 * não havia como saber QUAL campo recusou: nem na tela, nem no log. Só saiu
 * reproduzindo o upsert à mão no Postgres. Os dois consertos andam juntos por
 * isso — o segundo é o que torna o primeiro diagnosticável se ele voltar de
 * outra forma.
 *
 * ─── O que este arquivo mede ────────────────────────────────────────────────
 *
 * O payload que chega ao banco, não a resposta HTTP: o defeito era exatamente
 * um campo a mais no objeto enviado. Verificar só o status devolveria verde com
 * `null` de volta no dia em que alguém "simplificasse" o espalhamento.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const ORG = "33333333-3333-4333-8333-333333333333";
const SESSAO = "44444444-4444-4444-8444-444444444444";

vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => {}) }));
vi.mock("@/lib/auth/require-role", () => ({
  requireRole: vi.fn(async () => ({
    ok: true as const,
    user: { id: "u1" },
    org: { orgId: ORG },
  })),
}));

/** O que o `upsert` recebeu — é sobre isto que as asserções falam. */
let payloadDoUpsert: Record<string, unknown> | null = null;
/** Erro que o banco devolve no upsert, para o caso de mensagem. */
let erroDoUpsert: { message: string } | null = null;

function fakeAdmin() {
  const encadeavel: Record<string, unknown> = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "maybeSingle") return async () => ({ data: { id: SESSAO }, error: null });
        if (prop === "single") return async () => ({ data: { id: SESSAO }, error: null });
        if (prop === "then") return undefined;
        if (prop === "error") return null;
        if (prop === "data") return { id: SESSAO };
        return () => encadeavel;
      },
    },
  );
  return {
    from: () => ({
      select: () => encadeavel,
      update: () => encadeavel,
      upsert: (payload: Record<string, unknown>) => {
        payloadDoUpsert = payload;
        return { error: erroDoUpsert };
      },
    }),
  };
}
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fakeAdmin() }));

async function salvar(corpo: Record<string, unknown>): Promise<Response> {
  // Via `unknown`: o módulo tem forma própria e o `tsc` recusa a conversão
  // direta. Ler os três verbos em vez de fixar um deixa o arquivo sobreviver se
  // a rota trocar de método — o que ele mede é o payload, não o verbo.
  const { PATCH, POST, PUT } = (await import("@/app/api/v1/ai/pacing/route")) as unknown as Record<
    string,
    ((req: unknown) => Promise<Response>) | undefined
  >;
  const handler = PATCH ?? PUT ?? POST;
  if (!handler) throw new Error("a rota de pacing não expõe PATCH/PUT/POST");
  return handler({ json: async () => corpo } as never);
}

const BASE = {
  channel_session_id: SESSAO,
  window_start_hour: 7,
  window_end_hour: 22,
  allow_sunday: true,
};

afterEach(() => {
  payloadDoUpsert = null;
  erroDoUpsert = null;
});

describe("Proteção de envio — data do número em branco", () => {
  it("com a data em BRANCO, o campo NÃO vai no payload — o default da coluna age", async () => {
    await salvar({ ...BASE, number_activated_at: null });

    // A asserção central. `null` explícito anula o `default now()` e o insert
    // morre com 23502; ausência deixa o banco escrever `now()`, que é o
    // "tratado como recém-criado" que a tela promete.
    expect(payloadDoUpsert).not.toBeNull();
    expect(Object.keys(payloadDoUpsert!)).not.toContain("number_activated_at");
  });

  it("com data PREENCHIDA, ela vai — senão a idade do número seria ignorada", async () => {
    const data = "2026-01-15T12:00:00.000Z";
    await salvar({ ...BASE, number_activated_at: data });

    expect(payloadDoUpsert).toMatchObject({ number_activated_at: data });
  });

  it("o erro do BANCO chega na mensagem — foi a sua ausência que escondeu o defeito", async () => {
    erroDoUpsert = { message: 'null value in column "x" violates not-null constraint' };

    const res = await salvar({ ...BASE, number_activated_at: null });
    const body = (await res.json()) as { error?: { message?: string } };

    expect(res.status).toBe(500);
    // Sem isto, "Falha ao salvar os knobs" não diz qual campo recusou, e o
    // operador não tem o que fazer com a frase.
    expect(body.error?.message).toContain("not-null constraint");
  });
});
