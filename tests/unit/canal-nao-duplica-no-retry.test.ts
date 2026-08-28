/**
 * `POST /api/v1/channel-sessions` é idempotente sob retentativa.
 *
 * ─── O defeito, medido em produção ──────────────────────────────────────────
 *
 * UM clique em "Conectar novo WhatsApp" criou DUAS sessões. Prova no
 * `api_audit_log` de uma instalação real: dois `channel.connected` com
 * `request_id` DISTINTOS, 489 ms apart — e 375 ms na tentativa anterior. Uma
 * pareava; a outra ficava órfã em FAILED, e o operador apagava na mão.
 *
 * Não era duplo clique: `lib/api/client.ts` RETENTA mutação (`:126`, `:151`,
 * `:188`) e esta rota chama `waha.startSession()` DEPOIS do insert. WAHA lento
 * faz o cliente abortar (timeout de 10 s, `:16`) e retentar com a linha gravada.
 *
 * ─── Por que testar a ROTA, e não uma função pura ───────────────────────────
 *
 * A primeira versão deste arquivo testava um `ehPareamentoPendente()` que a rota
 * NÃO chamava. Apagar a guarda inteira deixava os sete casos verdes — o teste
 * media uma regra que não governava nada. Aqui a rota é exercitada, e o fake do
 * Supabase devolve o `23505` que o índice parcial da migration 0204 produz.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const ORG = "11111111-1111-4111-8111-111111111111";
const USER = "55555555-5555-4555-8555-555555555555";
const PENDENTE = { id: "aaaa1111-1111-4111-8111-111111111111", status: "SCAN_QR_CODE" };

vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => {}) }));
vi.mock("@/lib/auth/require-role", () => ({
  requireRole: vi.fn(async () => ({
    ok: true as const,
    user: { id: USER },
    org: { orgId: ORG },
  })),
}));

const startSession = vi.fn(async () => {});
vi.mock("@/lib/waha/client", () => ({
  getWahaClient: () => ({ startSession }),
  wahaFriendlyError: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));

/** O que o insert vai devolver — trocado por caso. */
let respostaDoInsert: { data: unknown; error: { code?: string; message: string } | null } = {
  data: { id: "nova", status: "STARTING" },
  error: null,
};
/** O que a busca da vencedora devolve depois de um 23505. */
let vencedora: unknown = PENDENTE;
/** Registra o que a rota fez com a linha quando o WAHA falhou. */
const chamadas: Array<{ op: string; payload?: unknown }> = [];
/**
 * O que o UPDATE de compensação devolve.
 *
 * Existe porque o Proxy abaixo respondia `() => encadeavel` para QUALQUER
 * propriedade — inclusive `error`. Uma função é truthy, então o ramo
 * "compensação falhou" disparava em TODA execução e os casos passavam sem
 * distinguir compensação boa de ruim. Quem mudasse esse ramo exercitaria o
 * caminho errado sem perceber.
 */
let respostaDoUpdate: { error: { message: string } | null } = { error: null };

function fakeSupabase() {
  const q: Record<string, unknown> = {};
  const encadeavel = new Proxy(q, {
    get(_t, prop) {
      if (prop === "maybeSingle") return async () => ({ data: vencedora, error: null });
      if (prop === "single") return async () => respostaDoInsert;
      if (prop === "then") return undefined;
      // `error`/`data` são LIDOS, não chamados: o `await` de uma cadeia sem
      // `then` devolve o próprio objeto, e quem consome faz `{ error } = ...`.
      if (prop === "error") return respostaDoUpdate.error;
      if (prop === "data") return null;
      return () => encadeavel;
    },
  });
  return {
    from: () => ({
      select: () => encadeavel,
      insert: () => {
        chamadas.push({ op: "insert" });
        return encadeavel;
      },
      update: (payload: unknown) => {
        chamadas.push({ op: "update", payload });
        return encadeavel;
      },
      delete: () => {
        chamadas.push({ op: "delete" });
        return encadeavel;
      },
    }),
  };
}
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => fakeSupabase() }));

async function chamarPost(): Promise<Response> {
  const { POST } = await import("@/app/api/v1/channel-sessions/route");
  return POST({ json: async () => ({}) } as never);
}

afterEach(() => {
  chamadas.length = 0;
  startSession.mockReset();
  startSession.mockImplementation(async () => {});
  respostaDoInsert = { data: { id: "nova", status: "STARTING" }, error: null };
  respostaDoUpdate = { error: null };
  vencedora = PENDENTE;
});

describe("POST /channel-sessions — retentativa não duplica sessão", () => {
  it("primeira chamada cria e responde 201", async () => {
    const res = await chamarPost();
    expect(res.status).toBe(201);
    expect(chamadas.filter((c) => c.op === "insert")).toHaveLength(1);
  });

  it("a RETENTATIVA recebe 200 com a sessão que já estava pendente", async () => {
    // 23505 é o que o índice parcial da 0204 devolve quando a org já tem um
    // pareamento em andamento. É o caso real: a linha da 1ª tentativa existe.
    respostaDoInsert = { data: null, error: { code: "23505", message: "duplicate key" } };

    const res = await chamarPost();
    expect(res.status).toBe(200);

    const body = (await res.json()) as { data: { id: string } };
    // A asserção que importa: devolve a EXISTENTE, não uma nova. Sem isto o
    // operador recebe um id que ninguém está pareando e a tela mostra QR morto.
    expect(body.data.id).toBe(PENDENTE.id);
  });

  it("com conflito, NÃO chama o WAHA — a sessão que vale já foi iniciada", async () => {
    respostaDoInsert = { data: null, error: { code: "23505", message: "duplicate key" } };
    await chamarPost();
    expect(startSession).not.toHaveBeenCalled();
  });

  it("conflito + vencedora sumiu → 409, não uma resposta inventada", async () => {
    // Acontece quando a outra requisição falhou no WAHA e marcou FAILED entre o
    // conflito e esta leitura. Quem chamou tenta de novo e aí consegue criar.
    respostaDoInsert = { data: null, error: { code: "23505", message: "duplicate key" } };
    vencedora = null;

    const res = await chamarPost();
    expect(res.status).toBe(409);
  });

  it("erro de banco que NÃO é 23505 continua sendo 500", async () => {
    // A guarda é estreita de propósito: só o conflito da trava vira 200. Coluna
    // ausente, permissão negada e afins seguem falhando alto.
    respostaDoInsert = { data: null, error: { code: "42703", message: "column missing" } };

    const res = await chamarPost();
    expect(res.status).toBe(500);
  });

  it("WAHA falhando MARCA a linha como FAILED — nunca a apaga", async () => {
    // O `delete` de antes criava um defeito pior junto com a trava: a
    // retentativa que recebeu 200 com esta linha ficaria consultando um id
    // inexistente, e a tela do QR travaria em "Preparando…" para sempre.
    startSession.mockRejectedValueOnce(new Error("waha fora do ar"));

    const res = await chamarPost();
    expect(res.status).toBe(502);

    expect(chamadas.some((c) => c.op === "delete")).toBe(false);
    const update = chamadas.find((c) => c.op === "update");
    expect(update?.payload).toMatchObject({ status: "FAILED" });
  });

  it("compensação que FALHA não some — o id da linha presa vai para o log", async () => {
    // Sem isto a linha fica `STARTING`, segura o índice da 0204, e toda
    // tentativa seguinte recebe 200 apontando para ela enquanto o WAHA estiver
    // fora. O erro do banco é a única pista de onde destravar.
    startSession.mockRejectedValueOnce(new Error("waha fora do ar"));
    respostaDoUpdate = { error: { message: "permission denied" } };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await chamarPost();
    expect(res.status).toBe(502);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("compensação falhou"),
      expect.objectContaining({ erro: "permission denied" }),
    );
    log.mockRestore();
  });

  it("compensação que PASSA não escreve no log — senão o ruído esconde o sinal", async () => {
    startSession.mockRejectedValueOnce(new Error("waha fora do ar"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    await chamarPost();

    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
