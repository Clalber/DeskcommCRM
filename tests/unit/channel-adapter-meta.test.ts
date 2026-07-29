import { afterEach, describe, expect, it, vi } from "vitest";

import { getAdapter } from "@/lib/channels";

const a = () => getAdapter("meta_cloud");

function configurar() {
  vi.stubEnv("META_PHONE_NUMBER_ID", "1103328999528818");
  vi.stubEnv("META_SYSTEM_USER_TOKEN", "tok");
  vi.stubEnv("META_GRAPH_VERSION", "v22.0");
}

function stubFetch(resposta: unknown, ok = true) {
  const spy = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 400,
    json: async () => resposta,
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("adapter meta_cloud — endereçamento", () => {
  it("telefone vira E.164 em DÍGITOS, sem + e sem sufixo", () => {
    // `@c.us` é do outro canal. Um `+` sobrevivente vira (#131009) na Meta.
    expect(a().resolveRecipient({
      isGroup: false, groupChatId: null, phoneNumber: "+55 (31) 99896-6398", waIdentity: null,
    })).toBe("5531998966398");
  });

  it("grupo devolve null — a API de grupos não faz parte deste seam", () => {
    expect(a().resolveRecipient({
      isGroup: true, groupChatId: "123@g.us", phoneNumber: "+5531999998888", waIdentity: null,
    })).toBeNull();
  });

  it("sem telefone devolve null — não há `lid` neste canal", () => {
    expect(a().resolveRecipient({
      isGroup: false, groupChatId: null, phoneNumber: null, waIdentity: "lid:12345",
    })).toBeNull();
  });
});

describe("adapter meta_cloud — configuração", () => {
  it("sem credencial NÃO está configurado", () => {
    vi.stubEnv("META_PHONE_NUMBER_ID", "");
    vi.stubEnv("META_SYSTEM_USER_TOKEN", "");
    expect(a().isConfigured()).toBe(false);
  });

  it("com credencial está configurado", () => {
    configurar();
    expect(a().isConfigured()).toBe(true);
  });

  it("não configurado é NOOP no envio, nunca exceção", async () => {
    // Mesmo contrato do outro canal: a UI mostra banner, o handler grava `queued`.
    vi.stubEnv("META_PHONE_NUMBER_ID", "");
    vi.stubEnv("META_SYSTEM_USER_TOKEN", "");
    const r = await a().send({ sessionRef: "x", to: "5531999", kind: "text", body: "oi" });
    expect(r).toEqual({ externalId: null });
  });

  it("os códigos carregam o nome do provider — por isso vivem no adapter", () => {
    expect(a().codes.notConfigured).toContain("meta");
    expect(a().codes.sendFailed).toContain("meta");
  });
});

describe("adapter meta_cloud — envio", () => {
  it("texto vai como type:text e o phone_number_id entra na URL, não no corpo", async () => {
    configurar();
    const spy = stubFetch({ messages: [{ id: "wamid.T" }] });
    const r = await a().send({ sessionRef: "ignorado", to: "5531998966398", kind: "text", body: "oi" });

    expect(r).toEqual({ externalId: "wamid.T" });
    const [url, init] = spy.mock.calls[0]!;
    expect(url).toContain("/v22.0/1103328999528818/messages");
    const corpo = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(corpo).toMatchObject({ messaging_product: "whatsapp", to: "5531998966398", type: "text" });
    expect(corpo).not.toHaveProperty("session");
  });

  it("áudio leva voice:true — sem isso vira anexo de música, não nota de voz", async () => {
    configurar();
    const spy = stubFetch({ messages: [{ id: "wamid.A" }] });
    await a().send({
      sessionRef: "x", to: "5531998966398", kind: "audio",
      media: { url: "https://x/a.ogg", mime: "audio/ogg" },
    });
    const corpo = JSON.parse(spy.mock.calls[0]![1].body as string) as {
      type: string; audio: { link: string; voice: boolean };
    };
    expect(corpo.type).toBe("audio");
    expect(corpo.audio.voice).toBe(true);
  });

  it("imagem leva caption; documento leva filename", async () => {
    configurar();
    const spy = stubFetch({ messages: [{ id: "wamid.I" }] });
    await a().send({
      sessionRef: "x", to: "5531", kind: "image",
      media: { url: "https://x/a.jpg", mime: "image/jpeg", caption: "olha" },
    });
    expect(JSON.parse(spy.mock.calls[0]![1].body as string).image).toEqual({
      link: "https://x/a.jpg", caption: "olha",
    });

    const spy2 = stubFetch({ messages: [{ id: "wamid.D" }] });
    await a().send({
      sessionRef: "x", to: "5531", kind: "document",
      media: { url: "https://x/a.pdf", mime: "application/pdf", filename: "contrato.pdf" },
    });
    expect(JSON.parse(spy2.mock.calls[0]![1].body as string).document).toMatchObject({
      filename: "contrato.pdf",
    });
  });

  it("erro da Meta lança com o `details`, que diz QUAL parâmetro divergiu", async () => {
    configurar();
    stubFetch(
      {
        error: {
          code: 131009,
          message: "Parameter value is not valid",
          error_data: { details: "to: número em formato inválido" },
        },
      },
      false,
    );
    await expect(
      a().send({ sessionRef: "x", to: "+5531", kind: "text", body: "oi" }),
    ).rejects.toThrow(/131009.*formato inválido/);
  });

  it("resposta sem id devolve externalId null, sem estourar", async () => {
    configurar();
    stubFetch({ messages: [] });
    const r = await a().send({ sessionRef: "x", to: "5531", kind: "text", body: "oi" });
    expect(r).toEqual({ externalId: null });
  });
});
