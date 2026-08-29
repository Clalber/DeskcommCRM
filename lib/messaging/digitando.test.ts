/**
 * A resolução conversa → sessão → destinatário do indicador "digitando…".
 *
 * Três coisas são vigiadas aqui, e a primeira é a que não pode falhar nunca:
 *
 *   1. **o filtro de organização.** Esta função é chamada com client de service
 *      role, que BYPASSA RLS. O `.eq("organization_id", …)` é a única coisa
 *      entre esta leitura e a conversa de outro tenant (anti-pattern nº 10);
 *   2. **nada sai daqui** — nem exceção do banco, nem exceção do canal. É essa
 *      promessa que permite chamá-la de dentro do caminho que responde o cliente;
 *   3. **quem não deve receber, não recebe sinal**: contato bloqueado e canal
 *      fora do ar não viram "digitando…".
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAdapter } from "@/lib/channels";

import { sinalizarDigitando } from "./digitando";

vi.mock("@/lib/channels", () => ({
  getAdapter: vi.fn(),
  resolveSessionRef: (s: { ref_da_sessao?: string }) => s.ref_da_sessao ?? "sessao",
  CHANNEL_SESSION_REF_COLUMNS: "provider, ref_da_sessao",
  DEFAULT_CHANNEL_PROVIDER: "canal_de_teste",
}));

const mockGetAdapter = vi.mocked(getAdapter);

const CONVERSA = {
  organization_id: "org-1",
  is_group: false,
  group_chat_id: null,
  contacts: {
    phone_number: "+5511999999999",
    wa_identity: "phone:+5511999999999",
    wa_lid: null,
    is_blocked: false,
  },
  channel_sessions: { provider: "canal_de_teste", ref_da_sessao: "sessao-1", status: "WORKING" },
};

/**
 * Dublê do PostgREST que GUARDA os filtros aplicados — é o que permite provar o
 * escopo de tenant em vez de acreditar nele.
 */
function supabaseCom(resposta: { data: unknown; error: unknown }): {
  client: Parameters<typeof sinalizarDigitando>[0];
  filtros: Array<[string, unknown]>;
} {
  const filtros: Array<[string, unknown]> = [];
  const query = {
    select: () => query,
    eq: (coluna: string, valor: unknown) => {
      filtros.push([coluna, valor]);
      return query;
    },
    maybeSingle: async () => resposta,
  };
  const client = { from: () => query } as unknown as Parameters<typeof sinalizarDigitando>[0];
  return { client, filtros };
}

function adapterCom(over: Partial<ReturnType<typeof getAdapter>> = {}): ReturnType<typeof getAdapter> {
  return {
    provider: "canal_de_teste",
    resolveRecipient: () => "5511999999999@c.us",
    isConfigured: () => true,
    send: async () => ({ externalId: null }),
    codes: { notConfigured: "nao_configurado", sendFailed: "falhou", unknownError: "desconhecido" },
    setTyping: vi.fn(async () => true),
    ...over,
  } as unknown as ReturnType<typeof getAdapter>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sinalizarDigitando", () => {
  it("sinaliza pelo canal da conversa — e SEMPRE escopado à organização", async () => {
    const setTyping = vi.fn(async () => true);
    mockGetAdapter.mockReturnValue(adapterCom({ setTyping }));
    const { client, filtros } = supabaseCom({ data: CONVERSA, error: null });

    const desfecho = await sinalizarDigitando(client, {
      organizationId: "org-1",
      conversationId: "conv-1",
      ligado: true,
    });

    expect(desfecho).toBe("sinalizado");
    // O filtro de tenant é a asserção principal deste arquivo: sem ele, um id de
    // conversa de outro tenant sinalizaria pelo canal errado.
    expect(filtros).toContainEqual(["organization_id", "org-1"]);
    expect(filtros).toContainEqual(["id", "conv-1"]);
    expect(setTyping).toHaveBeenCalledWith({
      organizationId: "org-1",
      sessionRef: "sessao-1",
      recipient: "5511999999999@c.us",
      typing: true,
    });
  });

  it("desliga com a mesma porta (typing: false)", async () => {
    const setTyping = vi.fn(async () => true);
    mockGetAdapter.mockReturnValue(adapterCom({ setTyping }));
    const { client } = supabaseCom({ data: CONVERSA, error: null });

    await sinalizarDigitando(client, {
      organizationId: "org-1",
      conversationId: "conv-1",
      ligado: false,
    });

    expect(setTyping).toHaveBeenCalledWith(expect.objectContaining({ typing: false }));
  });

  it("contato bloqueado não vê sinal de vida", async () => {
    const setTyping = vi.fn(async () => true);
    mockGetAdapter.mockReturnValue(adapterCom({ setTyping }));
    const { client } = supabaseCom({
      data: { ...CONVERSA, contacts: { ...CONVERSA.contacts, is_blocked: true } },
      error: null,
    });

    const desfecho = await sinalizarDigitando(client, {
      organizationId: "org-1",
      conversationId: "conv-1",
      ligado: true,
    });

    // Quem pediu para não ser incomodado não recebe nem o enfeite — e o canal
    // não é sequer consultado.
    expect(desfecho).toBe("sem_destino");
    expect(setTyping).not.toHaveBeenCalled();
  });

  it("sessão fora do ar não sinaliza", async () => {
    const setTyping = vi.fn(async () => true);
    mockGetAdapter.mockReturnValue(adapterCom({ setTyping }));
    const { client } = supabaseCom({
      data: { ...CONVERSA, channel_sessions: { ...CONVERSA.channel_sessions, status: "SCAN_QR_CODE" } },
      error: null,
    });

    expect(
      await sinalizarDigitando(client, {
        organizationId: "org-1",
        conversationId: "conv-1",
        ligado: true,
      }),
    ).toBe("canal_fora");
    expect(setTyping).not.toHaveBeenCalled();
  });

  it("canal sem indicador devolve sem_suporte, não erro", async () => {
    mockGetAdapter.mockReturnValue(adapterCom({ setTyping: undefined }));
    const { client } = supabaseCom({ data: CONVERSA, error: null });

    expect(
      await sinalizarDigitando(client, {
        organizationId: "org-1",
        conversationId: "conv-1",
        ligado: true,
      }),
    ).toBe("sem_suporte");
  });

  it("contato sem endereço no canal devolve sem_destino", async () => {
    mockGetAdapter.mockReturnValue(adapterCom({ resolveRecipient: () => null }));
    const { client } = supabaseCom({ data: CONVERSA, error: null });

    expect(
      await sinalizarDigitando(client, {
        organizationId: "org-1",
        conversationId: "conv-1",
        ligado: true,
      }),
    ).toBe("sem_destino");
  });

  it("erro de leitura vira 'erro' — nunca exceção", async () => {
    mockGetAdapter.mockReturnValue(adapterCom());
    const { client } = supabaseCom({ data: null, error: { message: "boom" } });

    await expect(
      sinalizarDigitando(client, {
        organizationId: "org-1",
        conversationId: "conv-1",
        ligado: true,
      }),
    ).resolves.toBe("erro");
  });

  it("canal que LANÇA não derruba quem chamou", async () => {
    mockGetAdapter.mockReturnValue(
      adapterCom({
        setTyping: vi.fn(async () => {
          throw new Error("transporte fora");
        }),
      }),
    );
    const { client } = supabaseCom({ data: CONVERSA, error: null });

    // Esta é a razão de a função existir com blindagem própria: o turno do
    // agente a chama sem `try`, e uma exceção daqui derrubaria a resposta ao
    // cliente por causa do balãozinho.
    await expect(
      sinalizarDigitando(client, {
        organizationId: "org-1",
        conversationId: "conv-1",
        ligado: true,
      }),
    ).resolves.toBe("erro");
  });
});
