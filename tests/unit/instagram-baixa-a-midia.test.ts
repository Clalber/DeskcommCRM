/**
 * A mídia do Direct chega até o disco.
 *
 * ─── O defeito, medido em produção ──────────────────────────────────────────
 *
 * Imagem e áudio apareciam na conversa e nunca carregavam:
 *
 *     16:18 | audio | url=ok | mime=audio/mp4  | guardada=NAO
 *     16:01 | image | url=ok | mime=image/jpeg | guardada=NAO
 *
 * O evento de download era processado COM SUCESSO, e o desfecho era
 * `canal_sem_midia_de_entrada`: o worker de persistência testa a PRESENÇA de
 * `fetchInboundMedia` no adapter e, sem ela, desiste em silêncio. Eu tinha
 * gravado a URL e emitido o pedido, e esqueci de ensinar o canal a buscar os
 * bytes — nada falhava, só não acontecia.
 *
 * O atendente via "imagem" sem imagem, e o agente de IA recebia uma mensagem
 * sem conteúdo nenhum para responder.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A guarda de DNS é dublada: um teste de unidade que resolve nome de verdade
// fica refém da rede do CI, e a primeira versão deste arquivo ficou vermelha por
// isso — não por defeito. A lista de hosts é medida à parte, como função pura.
vi.mock("@/lib/automation/outbound-ip", () => ({
  assertDestinoResolvidoSeguro: async () => undefined,
}));

import { hostEhDaMeta, metaInstagramAdapter } from "@/lib/channels/adapters/meta-instagram";
import { MAX_MEDIA_BYTES } from "@/lib/messaging/media/types";

const ORG = "11111111-1111-4111-8111-111111111111";
const CONTA = "17841400484683295";
const URL_DA_META = "https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=1&signature=abc";

let chamada: { url: string; init: RequestInit } | null = null;
let resposta: { ok: boolean; status: number; statusText: string; headers: Record<string, string>; corpo: Buffer };

function metaResponde() {
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    chamada = { url: String(url), init };
    return {
      ok: resposta.ok,
      status: resposta.status,
      statusText: resposta.statusText,
      headers: { get: (h: string) => resposta.headers[h.toLowerCase()] ?? null },
      arrayBuffer: async () => resposta.corpo,
    } as unknown as Response;
  });
}

const buscar = (url = URL_DA_META, hintMime: string | null = "image/jpeg") =>
  metaInstagramAdapter.fetchInboundMedia!({
    organizationId: ORG,
    sessionRef: CONTA,
    url,
    hintMime,
  });

beforeEach(() => {
  chamada = null;
  resposta = {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: { "content-type": "image/jpeg", "content-length": "2048" },
    corpo: Buffer.alloc(2048, 7),
  };
  metaResponde();
});

afterEach(() => vi.unstubAllGlobals());

describe("baixar a mídia", () => {
  it("traz os bytes e o mime da RESPOSTA", async () => {
    const r = await buscar();
    expect(r.buffer.byteLength).toBe(2048);
    // O `content-type` da resposta manda sobre a dica do webhook: é o que o
    // arquivo REALMENTE é, e é ele que vai no upload.
    expect(r.mime).toBe("image/jpeg");
  });

  it("o cabeçalho da resposta vence a dica do webhook", async () => {
    resposta.headers["content-type"] = "audio/mpeg; charset=binary";
    const r = await buscar(URL_DA_META, "image/jpeg");
    expect(r.mime).toBe("audio/mpeg");
  });

  it("⚠️ NÃO manda credencial no cabeçalho — e isso é decisão de segurança", async () => {
    await buscar();
    const headers = (chamada?.init.headers ?? {}) as Record<string, string>;

    // A URL vem do PAYLOAD do webhook. O canal intermediado manda a chave do
    // tenant neste fetch, e o comentário dele nomeia o preço: um payload hostil
    // faz o servidor ENTREGAR a credencial ao host que o atacante escolheu.
    // A CDN da Meta serve por URL já assinada, então não mandar nada apaga essa
    // classe inteira de risco em vez de mitigá-la.
    expect(headers.Authorization).toBeUndefined();
    expect(headers.authorization).toBeUndefined();
  });
});

describe("as recusas", () => {
  it("URL de rede interna é recusada ANTES do fetch", async () => {
    // SSRF. Sem esta guarda, um payload com endereço interno faz o servidor
    // varrer a própria rede e ler metadado de nuvem — e isso vale mesmo sem
    // credencial junto.
    await expect(buscar("http://169.254.169.254/latest/meta-data/")).rejects.toThrow();
    expect(chamada, "não podia ter saído requisição nenhuma").toBeNull();
  });

  it("URL VENCIDA leva o status na mensagem", async () => {
    // A Meta expira o anexo. 403/404 é "não volta mais"; 5xx é indisponibilidade
    // que passa. O status é o que distingue os dois para quem investiga.
    resposta = { ...resposta, ok: false, status: 403, statusText: "Forbidden" };
    await expect(buscar()).rejects.toThrow(/403/);
  });

  it("arquivo grande demais é recusado pelo CABEÇALHO, sem ler o corpo", async () => {
    // Medir só depois de ler significa que gigabytes já entraram na memória do
    // worker — que atende TODAS as organizações da instalação.
    resposta.headers["content-length"] = String(MAX_MEDIA_BYTES + 1);
    await expect(buscar()).rejects.toThrow(/exceeds/);
  });

  it("e também DEPOIS, porque o cabeçalho é declaração e não promessa", async () => {
    // Quem omite o `content-length` passaria reto pela primeira conferência.
    delete resposta.headers["content-length"];
    resposta.corpo = Buffer.alloc(MAX_MEDIA_BYTES + 10, 1);
    await expect(buscar()).rejects.toThrow(/exceeds/);
  });

  it("queda de rede vira erro NOMEADO, não exceção crua", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("ECONNRESET");
    });
    await expect(buscar()).rejects.toThrow(/instagram_media_failed/);
  });
});

describe("só a CDN da Meta, e sem seguir redirecionamento", () => {
  it("host que NÃO é da Meta é recusado, mesmo sendo público e válido", async () => {
    // Esta é a guarda que fecha o furo que as genéricas deixam: elas julgam a
    // PRIMEIRA URL, e um host público aprovado que responda 302 para a rede
    // interna seria seguido sem revalidação. Com a lista, o alvo deixa de ser
    // "qualquer host público".
    await expect(buscar("https://exemplo-qualquer.com/foto.jpg")).rejects.toThrow(
      /host não é da Meta/,
    );
    expect(chamada, "não podia ter saído requisição").toBeNull();
  });

  it("a lista aceita os hosts da Meta e recusa o resto — sem tocar a rede", () => {
    // `lookaside.fbsbx.com` foi MEDIDO: é de onde vieram as três mídias reais.
    expect(hostEhDaMeta("lookaside.fbsbx.com")).toBe(true);
    expect(hostEhDaMeta("scontent-gru2-1.cdninstagram.com")).toBe(true);
    expect(hostEhDaMeta("video.fbcdn.net")).toBe(true);

    expect(hostEhDaMeta("exemplo-qualquer.com")).toBe(false);
    // A armadilha do sufixo solto: sem o ponto na lista, um atacante registraria
    // `malicioso-fbcdn.net` e passaria.
    expect(hostEhDaMeta("malicioso-fbcdn.net")).toBe(false);
    expect(hostEhDaMeta("fbcdn.net.atacante.com")).toBe(false);
    // Caixa não decide segurança.
    expect(hostEhDaMeta("LOOKASIDE.FBSBX.COM")).toBe(true);
  });

  it("NÃO segue redirecionamento — seguir anularia as guardas", async () => {
    // Medido em produção: a CDN responde 200 direto, zero redirecionamentos.
    // Então não seguir não custa nada, e um 3xx passa a ser sinal de que algo
    // mudou — em vez de um salto silencioso para um destino não revalidado.
    await buscar();
    expect((chamada?.init as RequestInit).redirect).toBe("manual");
  });
});
