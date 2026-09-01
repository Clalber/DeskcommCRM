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

import { getAdapter, identidadePorContato } from "@/lib/channels";

import { sinalizarDigitando } from "./digitando";

vi.mock("@/lib/channels", () => ({
  getAdapter: vi.fn(),
  identidadePorContato: vi.fn(async () => null),
  resolveSessionRef: (s: { ref_da_sessao?: string }) => s.ref_da_sessao ?? "sessao",
  CHANNEL_SESSION_REF_COLUMNS: "provider, ref_da_sessao",
  DEFAULT_CHANNEL_PROVIDER: "canal_de_teste",
}));

const mockGetAdapter = vi.mocked(getAdapter);
const mockIdentidade = vi.mocked(identidadePorContato);

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

  it("canal que endereça por ID OPACO resolve pela identidade e SINALIZA", async () => {
    // ─── O defeito que este caso trava ────────────────────────────────────
    //
    // Um canal sem telefone (o contato nasce sem número, de propósito) é
    // endereçado por um id que a conta emitiu, guardado em
    // `channel_contact_identities`. O primeiro `resolveRecipient` devolve null
    // para ele, e esta função parava aí com "sem_destino" — ANTES de `setTyping`
    // ser chamado.
    //
    // Isso importava mais do que parece: implementar `setTyping` no adapter e
    // parar aí produziria um recurso que existe, tipa, tem teste próprio e NUNCA
    // acende. Foi medido lendo o código antes de escrever a implementação.
    const setTyping = vi.fn(async () => true);
    mockGetAdapter.mockReturnValue(
      adapterCom({
        // O adapter só sabe endereçar por id opaco — exatamente como o canal real.
        resolveRecipient: (entrada: { providerUserId?: string | null }) =>
          entrada.providerUserId ?? null,
        setTyping,
      }),
    );
    mockIdentidade.mockResolvedValue("9876543210000001");
    const { client } = supabaseCom({
      data: { ...CONVERSA, contact_id: "contato-1", channel_session_id: "sessao-uuid" },
      error: null,
    });

    const desfecho = await sinalizarDigitando(client, {
      organizationId: "org-1",
      conversationId: "conv-1",
      ligado: true,
    });

    expect(desfecho, "o canal por id opaco continua sem acender").toBe("sinalizado");
    expect(setTyping).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: "9876543210000001" }),
    );

    // O escopo da busca é a SESSÃO, não só a organização: o mesmo id pertence a
    // pessoas diferentes em contas diferentes, e sinalizar pela conta errada
    // mostraria sinal de vida na conversa de outra pessoa.
    expect(mockIdentidade).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        organizationId: "org-1",
        channelSessionId: "sessao-uuid",
        contactId: "contato-1",
      }),
    );
  });

  it("quem JÁ resolveu por telefone não paga a consulta de identidade", async () => {
    // A guarda do caminho quente. `manterDigitando` re-executa esta função a
    // cada renovação (8s), então uma consulta incondicional aqui sairia várias
    // vezes por turno, em todo canal por número, para nada.
    const setTyping = vi.fn(async () => true);
    mockGetAdapter.mockReturnValue(adapterCom({ setTyping }));
    const { client } = supabaseCom({
      data: { ...CONVERSA, contact_id: "contato-1", channel_session_id: "sessao-uuid" },
      error: null,
    });

    await sinalizarDigitando(client, {
      organizationId: "org-1",
      conversationId: "conv-1",
      ligado: true,
    });

    expect(mockIdentidade, "consultou identidade com o telefone já resolvido").not.toHaveBeenCalled();
  });

  it("identidade que LANÇA não derruba o turno", async () => {
    // A tabela pode estar indisponível. O contrato desta função é não deixar
    // nada escapar — e o pior caso aceitável segue sendo o balãozinho não vir.
    mockGetAdapter.mockReturnValue(
      adapterCom({
        resolveRecipient: (e: { providerUserId?: string | null }) => e.providerUserId ?? null,
      }),
    );
    mockIdentidade.mockRejectedValue(new Error("channel_contact_identity_lookup_failed"));
    const { client } = supabaseCom({
      data: { ...CONVERSA, contact_id: "contato-1", channel_session_id: "sessao-uuid" },
      error: null,
    });

    await expect(
      sinalizarDigitando(client, {
        organizationId: "org-1",
        conversationId: "conv-1",
        ligado: true,
      }),
    ).resolves.toBe("erro");
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
