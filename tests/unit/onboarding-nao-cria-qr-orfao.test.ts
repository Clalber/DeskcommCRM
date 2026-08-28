/**
 * O onboarding ADOTA o pareamento já em andamento — inclusive o NOME dele.
 *
 * ─── O defeito que este arquivo tranca ──────────────────────────────────────
 *
 * `POST /api/v1/onboarding/whatsapp/session` procura a sessão por NOME
 * (determinístico: `org_<8>`), e insere se não achar. Com o índice parcial da
 * migration 0203 no lugar, esse insert passa a bater em `23505` quando a org já
 * tem um pareamento em andamento — tipicamente um criado pela tela de Conexões,
 * cujo nome leva sufixo aleatório.
 *
 * Duas tentativas anteriores erraram, e as duas de forma SILENCIOSA:
 *
 *   1. Lançar no erro → 500 na primeira tela do produto.
 *   2. Devolver o `id` da pendente e SEGUIR → o WAHA subia `org_<8>` (sessão sem
 *      linha no banco) enquanto a resposta apontava para outra linha. O GET
 *      desta rota e o proxy do QR usam o nome determinístico, então a tela
 *      mostrava o QR da sessão errada; o aparelho pareava com uma sessão sem
 *      dono e a mensagem recebida era descartada — com o wizard dizendo
 *      "Conectado!".
 *
 * A resposta certa é NÃO seguir: 409 nomeando a conexão em andamento, para
 * resolver na Central. Por isso a asserção que importa não é o status sozinho —
 * é que o WAHA NÃO foi tocado.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const ORG = "22222222-2222-4222-8222-222222222222";
const USER = "66666666-6666-4666-8666-666666666666";

/** A pendente que a tela de Conexões criou — nome COM sufixo. */
const PENDENTE = {
  id: "bbbb2222-2222-4222-8222-222222222222",
  waha_session_name: "org_22222222_9f3c1a",
  display_name: "WhatsApp da Loja",
};

vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => {}) }));
vi.mock("@/lib/auth/server", () => ({
  loadAuthUser: vi.fn(async () => ({ id: USER })),
  resolveActiveOrg: vi.fn(async () => ({ orgId: ORG })),
}));
vi.mock("@/lib/channels/reactivate", () => ({
  reactivateChannelSession: vi.fn(async () => ({ error: null })),
}));

const startSession = vi.fn(async () => ({ status: "STARTING" }));
const stopSession = vi.fn(async () => {});
const getSessionQr = vi.fn(async () => ({ status: "RUNNING" }));
vi.mock("@/lib/waha/client", () => ({
  getWahaClient: () => ({ startSession, stopSession, getSessionQr }),
}));

/** O insert devolve conflito por padrão — é o caso sob teste. */
let respostaDoInsert: { data: unknown; error: { code?: string; message: string } | null } = {
  data: null,
  error: { code: "23505", message: "duplicate key" },
};
/** O que a busca da pendente devolve. `select("id")` já foi trocado por `select("id, waha_session_name")`. */
let pendente: unknown = PENDENTE;

function fakeSupabase() {
  const alvo: Record<string, unknown> = {};
  const encadeavel: Record<string, unknown> = new Proxy(alvo, {
    get(_t, prop) {
      // A busca POR NOME do topo da função: não acha nada, então a rota insere.
      // É o que põe o fluxo no caminho do 23505.
      if (prop === "maybeSingle") {
        return async () => ({ data: buscandoPendente ? pendente : null, error: null });
      }
      if (prop === "single") return async () => respostaDoInsert;
      if (prop === "then") return undefined;
      return (...args: unknown[]) => {
        // A busca da pendente é a única que filtra por `provider`.
        if (String(args[0]) === "provider") buscandoPendente = true;
        return encadeavel;
      };
    },
  });
  let buscandoPendente = false;
  return {
    from: () => ({
      select: () => {
        buscandoPendente = false;
        return encadeavel;
      },
      insert: () => encadeavel,
      update: () => encadeavel,
    }),
  };
}
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => fakeSupabase() }));

async function chamarPost(url = "http://x/api/v1/onboarding/whatsapp/session"): Promise<Response> {
  const { POST } = await import("@/app/api/v1/onboarding/whatsapp/session/route");
  return POST({ url } as never);
}

afterEach(() => {
  startSession.mockClear();
  stopSession.mockClear();
  getSessionQr.mockClear();
  respostaDoInsert = { data: null, error: { code: "23505", message: "duplicate key" } };
  pendente = PENDENTE;
});

describe("onboarding + pareamento já em andamento", () => {
  it("responde 409 em vez de 500 — onboarding que quebra é abandono", async () => {
    const res = await chamarPost();
    expect(res.status).toBe(409);
  });

  it("NÃO toca no WAHA — subir sessão aqui é o que cria o QR órfão", async () => {
    // A asserção central deste arquivo. Iniciar `org_<8>` faria o aparelho
    // parear com uma sessão que não tem linha no banco.
    await chamarPost();
    expect(startSession).not.toHaveBeenCalled();
    expect(stopSession).not.toHaveBeenCalled();
  });

  it("a mensagem usa o nome que o operador VÊ, não o identificador interno", async () => {
    const res = await chamarPost();
    const body = (await res.json()) as { error: { message: string } };

    expect(body.error.message).toContain(PENDENTE.display_name);
    // `waha_session_name` (`org_<8>_<rand>`) é o identificador que a própria
    // tela do onboarding removeu por inacionável, e que a Central não mostra em
    // canto nenhum. Dizê-lo seria dar um código sem onde casar.
    expect(body.error.message).not.toContain(PENDENTE.waha_session_name);
  });

  it("conexão sem nome ainda produz frase legível — nunca `null` na tela", async () => {
    pendente = { ...PENDENTE, display_name: null };
    const res = await chamarPost();
    const body = (await res.json()) as { error: { message: string } };

    expect(body.error.message).not.toContain("null");
    expect(body.error.message).toContain("sem nome");
  });

  it("`?restart=1` também não sobe nada quando há conflito", async () => {
    await chamarPost("http://x/api/v1/onboarding/whatsapp/session?restart=1");
    expect(stopSession).not.toHaveBeenCalled();
  });

  it("sem conflito, segue usando o nome determinístico do onboarding", async () => {
    // O caminho normal não pode ter sido alterado por este conserto.
    respostaDoInsert = { data: { id: "nova" }, error: null };
    await chamarPost();
    expect(startSession).toHaveBeenCalledWith(expect.stringMatching(/^org_22222222$/));
  });
});
