/**
 * A conta que recebeu, o aplicativo que tem a linha, e o toque em botão.
 *
 * Três achados de uma auditoria adversarial, medidos aqui:
 *
 * 1. **A conexão sai da CONTA, não do token da URL.** A Meta entrega por
 *    APLICATIVO: uma callback URL para todas as contas ligadas a ele. Numa
 *    organização com duas contas, as mensagens das duas chegavam no mesmo token
 *    e eram gravadas debaixo da mesma conexão — e o IGSID de uma conta saía
 *    depois pelo TOKEN da outra.
 * 2. **`standby` significa que OUTRO aplicativo está atendendo.** Responder dali
 *    é falar por cima de quem tem a linha; o cliente vê duas empresas
 *    respondendo a mesma pergunta.
 * 3. **Toque em botão é mensagem.** Quebra-gelo e menu chegam sem `message` e
 *    eram descartados: a pessoa tocava, esperava resposta, e não virava nem
 *    conversa.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ingerirEntradaDoInstagram } from "@/lib/channels/instagram/ingest";
import { sessaoDaConta } from "@/lib/channels/instagram/sessao-da-conta";
import { parseInstagramWebhook, type EventoDeEntrada } from "@/lib/channels/instagram/webhook";

const CONTA = "17841400000000001";
const PESSOA = "9876543210000001";
const ORG = "11111111-1111-4111-8111-111111111111";
const SESSAO = "22222222-2222-4222-8222-222222222222";

const envelope = (entrada: Record<string, unknown>) => ({
  object: "instagram",
  entry: [entrada],
});

const mensagem = (extra: Record<string, unknown> = {}) => ({
  sender: { id: PESSOA },
  recipient: { id: CONTA },
  timestamp: 1_756_000_000_000,
  message: { mid: "mid.1", text: "Oi", ...extra },
});

describe("standby — outro aplicativo tem a linha", () => {
  it("o evento vem marcado, e o de `messaging` NÃO vem", () => {
    const so = parseInstagramWebhook(envelope({ standby: [mensagem()] }));
    expect(so.eventos).toHaveLength(1);
    expect(so.eventos[0]!.emEspera).toBe(true);

    // O controle: sem ele, um `emEspera` fixo em `true` passaria neste arquivo.
    const normal = parseInstagramWebhook(envelope({ messaging: [mensagem()] }));
    expect(normal.eventos[0]!.emEspera).toBe(false);
  });

  it("os dois lotes no MESMO envelope não se contaminam", () => {
    const r = parseInstagramWebhook(
      envelope({
        messaging: [mensagem()],
        standby: [{ ...mensagem(), message: { mid: "mid.2", text: "Em espera" } }],
      }),
    );
    expect(r.eventos.map((e) => e.emEspera)).toEqual([false, true]);
  });
});

describe("toque em botão", () => {
  it("vira mensagem, com o RÓTULO como texto e a carga à parte", () => {
    const r = parseInstagramWebhook(
      envelope({
        messaging: [
          {
            sender: { id: PESSOA },
            recipient: { id: CONTA },
            timestamp: 1_756_000_000_000,
            postback: { mid: "mid.botao", title: "Ver preços", payload: "MENU_PRECOS" },
          },
        ],
      }),
    );

    expect(r.eventos).toHaveLength(1);
    const e = r.eventos[0]!;
    // O rótulo é o que a pessoa VIU e tocou — é o que faz sentido na conversa.
    expect(e.texto).toBe("Ver preços");
    expect(e.cargaDoBotao).toBe("MENU_PRECOS");
    expect(e.ehToqueEmBotao).toBe(true);
    expect(e.externalId).toBe("mid.botao");
    expect(r.ignorados).toBe(0);
  });

  it("sem `mid` é descartado — sem chave de idempotência a reentrega duplica", () => {
    const r = parseInstagramWebhook(
      envelope({
        messaging: [
          {
            sender: { id: PESSOA },
            recipient: { id: CONTA },
            postback: { title: "Ver preços" },
          },
        ],
      }),
    );
    expect(r.eventos).toHaveLength(0);
    expect(r.ignorados).toBe(1);
  });
});

describe("de onde a pessoa veio", () => {
  it("a atribuição de anúncio é lida, e não se perde mais", () => {
    const r = parseInstagramWebhook(
      envelope({
        messaging: [
          {
            ...mensagem(),
            referral: { ref: "promo-agosto", source: "ADS", type: "OPEN_THREAD", ad_id: "1234" },
          },
        ],
      }),
    );

    expect(r.eventos[0]!.referencia).toEqual({
      ref: "promo-agosto",
      origem: "ADS",
      tipo: "OPEN_THREAD",
      anuncioId: "1234",
    });
  });

  it("objeto vazio não vira atribuição — seria ruído no metadata", () => {
    const r = parseInstagramWebhook(
      envelope({ messaging: [{ ...mensagem(), referral: {} }] }),
    );
    expect(r.eventos[0]!.referencia).toBeNull();
  });
});

describe("a ingestão respeita quem tem a linha", () => {
  const efeitos = vi.hoisted(() => vi.fn(async () => {}));
  vi.mock("@/lib/channels/pos-entrada", () => ({ aplicarEfeitosPosEntrada: efeitos }));

  const banco = () => {
    const encadeavel: Record<string, unknown> = {};
    const proxy: Record<string, unknown> = new Proxy(encadeavel, {
      get(_t, prop) {
        if (prop === "maybeSingle" || prop === "single") {
          return async () => ({ data: { id: "id-1" }, error: null });
        }
        // A consulta que é AGUARDADA direto (sem `single`) — o upsert da
        // identidade é uma delas. Sem isto o `await` devolvia o próprio proxy e
        // o código lia um `error` que não existe.
        if (prop === "then") {
          return (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
        }
        return () => proxy;
      },
    });
    return {
      from: () => ({
        select: () => proxy,
        insert: () => proxy,
        update: () => proxy,
        upsert: () => proxy,
      }),
      rpc: async (nome: string) =>
        nome === "fn_upsert_conversation_do_canal"
          ? { data: "conversa-1", error: null }
          : { data: null, error: null },
    };
  };

  const evento = (extra: Partial<EventoDeEntrada> = {}): EventoDeEntrada => ({
    externalId: "mid.1",
    providerUserId: PESSOA,
    contaId: CONTA,
    texto: "Oi",
    midias: [],
    timestamp: 1_756_000_000_000,
    ehEco: false,
    ehApagada: false,
    respostaA: null,
    emEspera: false,
    referencia: null,
    ehToqueEmBotao: false,
    cargaDoBotao: null,
    ...extra,
  });

  beforeEach(() => efeitos.mockClear());

  it("em espera GRAVA a mensagem mas NÃO acorda o agente", async () => {
    const r = await ingerirEntradaDoInstagram(banco() as never, {
      organizationId: ORG,
      channelSessionId: SESSAO,
      evento: evento({ emEspera: true }),
    });

    // Gravar é certo: sem isso o histórico fica furado e ninguém entende a
    // conversa depois que a linha volta para nós.
    expect(r.status).toBe("ingested");
    // Responder é falar por cima do aplicativo que está atendendo agora.
    expect(efeitos).not.toHaveBeenCalled();
  });

  it("o controle: sem espera, o agente é acordado", async () => {
    await ingerirEntradaDoInstagram(banco() as never, {
      organizationId: ORG,
      channelSessionId: SESSAO,
      evento: evento(),
    });
    expect(efeitos).toHaveBeenCalledTimes(1);
  });
});

describe("a conexão da conta que recebeu", () => {
  /** Registra os filtros aplicados, para as asserções falarem sobre eles. */
  function bancoQueRegistra(resultado: unknown) {
    const filtros: Record<string, unknown> = {};
    const proxy: Record<string, unknown> = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === "maybeSingle") return async () => ({ data: resultado, error: null });
          if (prop === "then") return undefined;
          if (prop === "eq" || prop === "is") {
            return (coluna: string, valor: unknown) => {
              filtros[coluna] = valor;
              return proxy;
            };
          }
          return () => proxy;
        },
      },
    );
    return { admin: { from: () => ({ select: () => proxy }) }, filtros };
  }

  it("filtra organização, provider e conta — as três", async () => {
    const { admin, filtros } = bancoQueRegistra({ id: "sessao-b" });

    const r = await sessaoDaConta(admin as never, {
      organizationId: ORG,
      instagramUserId: CONTA,
    });

    expect(r).toEqual({ id: "sessao-b" });
    // Sem `organization_id` a busca cruzaria organizações — e o service role
    // bypassa RLS, então não há rede embaixo.
    expect(filtros.organization_id).toBe(ORG);
    expect(filtros.instagram_user_id).toBe(CONTA);
    expect(filtros.provider).toBeDefined();
  });

  it("conta desconhecida devolve null — cair no token refaria o defeito", async () => {
    const { admin } = bancoQueRegistra(null);
    await expect(
      sessaoDaConta(admin as never, { organizationId: ORG, instagramUserId: "outra" }),
    ).resolves.toBeNull();
  });

  it("sem conta não consulta nada", async () => {
    const { admin, filtros } = bancoQueRegistra({ id: "x" });
    await expect(
      sessaoDaConta(admin as never, { organizationId: ORG, instagramUserId: "" }),
    ).resolves.toBeNull();
    expect(Object.keys(filtros)).toHaveLength(0);
  });
});
