/**
 * O adapter do Instagram, contra uma Meta simulada.
 *
 * ─── O que se prova aqui ────────────────────────────────────────────────────
 *
 * 1. **A requisição que sai** — URL, método, e o token no HEADER e não na query.
 *    Query string vai para o log de qualquer proxy no caminho, e ali o token
 *    vira credencial vazada. É o tipo de coisa que ninguém revisa depois de
 *    escrita e que só um teste sobre a chamada REAL segura.
 * 2. **O limite de 1000 BYTES.** A Meta conta bytes; em português acentuado cada
 *    "ã" custa dois. Um teste que use texto ASCII passa com 1000 caracteres e
 *    deixa o defeito vivo para a primeira mensagem com acento.
 * 3. **Erro nomeado, não genérico.** Token morto (190) e fora da janela (10) têm
 *    desfechos diferentes — um pede reconexão, o outro pede uma pessoa. Colapsar
 *    os dois em "falhou" tira do operador a única informação acionável.
 * 4. **`reachable: false` NÃO é canal caído.** É "não deu para perguntar".
 *    Confundir faz uma falha de rede nossa aparecer como conta banida, e o cron
 *    sai marcando sessão que está viva.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { metaInstagramAdapter } from "@/lib/channels/adapters/meta-instagram";

const ORG = "11111111-1111-4111-8111-111111111111";
const CONTA = "17841400000000001";
const IGSID = "9876543210000001";
const TOKEN = "IGQVJT-token-de-teste";

/** A requisição que o adapter fez — é sobre ela que as asserções falam. */
let chamada: { url: string; init: RequestInit } | null = null;
/** O que a Meta simulada responde. */
let resposta: { ok: boolean; status: number; corpo: unknown } = {
  ok: true,
  status: 200,
  corpo: { recipient_id: IGSID, message_id: "mid.abc123" },
};
/** A credencial que o banco devolve. `null` = conta não conectada. */
let credencial: Record<string, unknown> | null = {
  instagram_user_id: CONTA,
  instagram_token_encrypted: "cifrado",
  instagram_token_expires_at: null,
};

vi.mock("@/lib/webhooks/secrets", () => ({
  decryptWebhookSecret: vi.fn(async () => TOKEN),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const encadeavel: Record<string, unknown> = {};
    const proxy = new Proxy(encadeavel, {
      get(_t, prop) {
        if (prop === "maybeSingle") return async () => ({ data: credencial, error: null });
        if (prop === "then") return undefined;
        return () => proxy;
      },
    });
    return { from: () => ({ select: () => proxy }) };
  },
}));

const envelope = (extra: Record<string, unknown> = {}) => ({
  organizationId: ORG,
  sessionRef: CONTA,
  to: IGSID,
  kind: "text" as const,
  body: "Olá!",
  ...extra,
});

beforeEach(() => {
  chamada = null;
  resposta = { ok: true, status: 200, corpo: { recipient_id: IGSID, message_id: "mid.abc123" } };
  credencial = {
    instagram_user_id: CONTA,
    instagram_token_encrypted: "cifrado",
    instagram_token_expires_at: null,
  };
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    chamada = { url: String(url), init };
    return {
      ok: resposta.ok,
      status: resposta.status,
      json: async () => resposta.corpo,
    } as Response;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("destinatário", () => {
  it("é o IGSID, e grupo é recusado — o Direct não tem grupo", () => {
    expect(
      metaInstagramAdapter.resolveRecipient({
        isGroup: false,
        groupChatId: null,
        phoneNumber: null,
        waIdentity: null,
        providerUserId: IGSID,
      }),
    ).toBe(IGSID);

    expect(
      metaInstagramAdapter.resolveRecipient({
        isGroup: true,
        groupChatId: "g",
        phoneNumber: null,
        waIdentity: null,
        providerUserId: IGSID,
      }),
    ).toBeNull();
  });

  it("sem identidade resolvida devolve null — inventar mandaria para outra pessoa", () => {
    expect(
      metaInstagramAdapter.resolveRecipient({
        isGroup: false,
        groupChatId: null,
        phoneNumber: "+5519999999999",
        waIdentity: "phone:+5519999999999",
      }),
    ).toBeNull();
  });
});

describe("envio", () => {
  it("monta a chamada certa e devolve o id da mensagem", async () => {
    const r = await metaInstagramAdapter.send(envelope() as never);

    expect(r).toEqual({ externalId: "mid.abc123" });
    expect(chamada?.url).toBe(`https://graph.instagram.com/v25.0/${CONTA}/messages`);
    expect(chamada?.init.method).toBe("POST");
    expect(JSON.parse(String(chamada?.init.body))).toEqual({
      recipient: { id: IGSID },
      message: { text: "Olá!" },
    });
  });

  it("manda o token no HEADER — na query ele vaza no log de qualquer proxy", () => {
    return metaInstagramAdapter.send(envelope() as never).then(() => {
      const headers = chamada?.init.headers as Record<string, string>;
      expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
      // A asserção que importa tanto quanto: o token NÃO está na URL.
      expect(chamada?.url).not.toContain(TOKEN);
      expect(chamada?.url).not.toContain("access_token");
    });
  });

  it("recusa texto acima de 1000 BYTES — e acento custa dois", async () => {
    // 501 "ç" = 1002 bytes em UTF-8, mas só 501 caracteres. Um limite contado em
    // caracteres deixaria isto passar, e a Meta recusaria com um erro que o
    // operador não relaciona com tamanho.
    const comAcento = "ç".repeat(501);
    expect(comAcento.length).toBeLessThan(1000);
    expect(Buffer.byteLength(comAcento, "utf8")).toBeGreaterThan(1000);

    await expect(
      metaInstagramAdapter.send(envelope({ body: comAcento }) as never),
    ).rejects.toThrow(/excede o limite de 1000/);

    // E não gastou a chamada: recusar antes é o que impede a mensagem de ficar
    // `failed` com uma razão ilegível.
    expect(chamada).toBeNull();
  });

  it("aceita exatamente 1000 bytes", async () => {
    await expect(
      metaInstagramAdapter.send(envelope({ body: "a".repeat(1000) }) as never),
    ).resolves.toEqual({ externalId: "mid.abc123" });
  });

  it("mídia vai por anexo com URL, não como texto", async () => {
    await metaInstagramAdapter.send(
      envelope({ kind: "image", body: null, media: { url: "https://x.test/f.jpg" } }) as never,
    );

    expect(JSON.parse(String(chamada?.init.body))).toEqual({
      recipient: { id: IGSID },
      message: { attachment: { type: "image", payload: { url: "https://x.test/f.jpg" } } },
    });
  });

  it("conta não conectada LANÇA — devolver id nulo gravaria `sent` sem ter saído", async () => {
    credencial = null;
    await expect(metaInstagramAdapter.send(envelope() as never)).rejects.toThrow(
      /instagram_not_configured/,
    );
  });

  it("token morto (190) diz RECONECTE, não 'falhou'", async () => {
    resposta = {
      ok: false,
      status: 401,
      corpo: { error: { code: 190, message: "Error validating access token" } },
    };

    await expect(metaInstagramAdapter.send(envelope() as never)).rejects.toThrow(
      /credencial expirada — reconecte/,
    );
  });

  it("fora da janela (10) diz que só uma PESSOA pode responder", async () => {
    resposta = {
      ok: false,
      status: 400,
      corpo: { error: { code: 10, error_subcode: 2534022, message: "outside of allowed window" } },
    };

    await expect(metaInstagramAdapter.send(envelope() as never)).rejects.toThrow(
      /fora da janela de 24h/,
    );
  });

  it("destinatário que BLOQUEOU é dito com todas as letras", async () => {
    resposta = {
      ok: false,
      status: 400,
      corpo: { error: { code: 551, message: "This person isn't receiving messages" } },
    };

    await expect(metaInstagramAdapter.send(envelope() as never)).rejects.toThrow(
      /não está recebendo mensagens suas.*definitivo/s,
    );
  });

  it("erro de COTA é marcado transitório — a fila deve insistir", async () => {
    resposta = { ok: false, status: 429, corpo: { error: { code: 613, message: "rate limit" } } };

    await expect(metaInstagramAdapter.send(envelope() as never)).rejects.toThrow(/transitório/);
  });

  it("`is_transient` do host do Instagram é a palavra final", async () => {
    // `graph.instagram.com` usa `IGApiException` e manda o sinal explícito. Um
    // código que a nossa lista não conhece, mas com `is_transient: true`, tem de
    // ser retentado — a alternativa é descartar mensagem por ignorância nossa.
    // Código 9999 NÃO está na nossa lista de retentáveis — de propósito. Se o
    // teste usasse um código conhecido, ele passaria mesmo com o `is_transient`
    // ignorado, e mediria a lista em vez do sinal. Medido por sabotagem.
    resposta = {
      ok: false,
      status: 500,
      corpo: {
        error: { code: 9999, is_transient: true, message: "IGApiException transitória" },
      },
    };

    await expect(metaInstagramAdapter.send(envelope() as never)).rejects.toThrow(/transitório/);
  });

  it("fora da janela é DEFINITIVO — retentar queima cota contra a parede", async () => {
    resposta = {
      ok: false,
      status: 400,
      corpo: { error: { code: 10, error_subcode: 2534022, message: "outside window" } },
    };

    await expect(metaInstagramAdapter.send(envelope() as never)).rejects.toThrow(/definitivo/);
  });

  it("erro sem código conhecido preserva a mensagem da Meta", async () => {
    resposta = { ok: false, status: 400, corpo: { error: { code: 4, message: "rate limited" } } };

    await expect(metaInstagramAdapter.send(envelope() as never)).rejects.toThrow(/rate limited/);
  });

  it("HTTP 200 com erro no corpo também falha — a Meta faz isso", async () => {
    resposta = { ok: true, status: 200, corpo: { error: { code: 100, message: "Unsupported" } } };

    await expect(metaInstagramAdapter.send(envelope() as never)).rejects.toThrow(/Unsupported/);
  });
});

describe("saúde", () => {
  it("conta viva responde WORKING", async () => {
    resposta = { ok: true, status: 200, corpo: { id: CONTA, username: "loja" } };

    await expect(
      metaInstagramAdapter.checkHealth!({ organizationId: ORG, sessionRef: CONTA }),
    ).resolves.toMatchObject({ reachable: true, status: "WORKING" });
  });

  it("credencial VENCIDA é vista antes de perguntar à Meta", async () => {
    credencial = {
      instagram_user_id: CONTA,
      instagram_token_encrypted: "cifrado",
      instagram_token_expires_at: new Date(Date.now() - 1000).toISOString(),
    };

    const s = await metaInstagramAdapter.checkHealth!({ organizationId: ORG, sessionRef: CONTA });

    expect(s).toMatchObject({ status: "FAILED", detail: "credencial vencida" });
    // Sem gastar chamada: é o que permite avisar ANTES de parar de funcionar.
    expect(chamada).toBeNull();
  });

  it("conta não conectada é STOPPED, não erro", async () => {
    credencial = null;
    await expect(
      metaInstagramAdapter.checkHealth!({ organizationId: ORG, sessionRef: CONTA }),
    ).resolves.toMatchObject({ reachable: true, status: "STOPPED" });
  });

  it("falha de REDE é `reachable: false` — não é canal caído", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("ECONNREFUSED");
    });

    const s = await metaInstagramAdapter.checkHealth!({ organizationId: ORG, sessionRef: CONTA });

    // A distinção que impede o cron de marcar como caída uma conta viva.
    expect(s.reachable).toBe(false);
    expect(s.status).toBeNull();
  });
});
