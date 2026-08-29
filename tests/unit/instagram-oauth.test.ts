/**
 * A autorização da conta de Instagram, contra uma Meta simulada.
 *
 * ─── O que se prova aqui ────────────────────────────────────────────────────
 *
 * 1. **O `state` é inforjável.** Ele é a ÚNICA coisa nossa que sobrevive à ida à
 *    Meta, volta pela URL — um canal que quem está conectando controla — e
 *    carrega a ORGANIZAÇÃO. Sem assinatura, editar um campo na barra de endereço
 *    grava a conta de Instagram de alguém no CRM de outra empresa. E como a rota
 *    de volta não pode exigir cookie (`SameSite=Strict` não o envia numa
 *    navegação vinda de outro site), esta assinatura é a ÚNICA autenticação da
 *    volta inteira.
 * 2. **`expires_in` vem em SEGUNDOS.** Tratá-lo como milissegundos põe o
 *    vencimento a um minuto de distância e faz o cron renovar sem parar; ao
 *    contrário, põe o vencimento em 2085 e o cron nunca renova — e este segundo
 *    erro só aparece no sexagésimo dia, quando o canal do cliente morre.
 * 3. **O token no CABEÇALHO.** Query string entra no log de qualquer proxy no
 *    caminho, e ali o token vira credencial vazada.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  VALIDADE_DO_ESTADO_MS,
  assinarEstado,
  conferirEstado,
  contaDoToken,
  limparCodigo,
  montarUrlDeAutorizacao,
  renovarTokenLongo,
  trocarCodigoPorTokenCurto,
} from "@/lib/channels/instagram/oauth";

const SEGREDO = "segredo-desta-instalacao";
const ORG = "11111111-1111-4111-8111-111111111111";
const SESSAO = "22222222-2222-4222-8222-222222222222";
const AGORA = new Date("2026-08-29T12:00:00.000Z");

const estadoValido = () => ({
  organizationId: ORG,
  channelSessionId: SESSAO,
  expiraEm: AGORA.getTime() + VALIDADE_DO_ESTADO_MS,
});

describe("o state que atravessa o navegador", () => {
  it("vai e volta inteiro quando ninguém mexe", () => {
    const assinado = assinarEstado(estadoValido(), SEGREDO);
    expect(conferirEstado(assinado, SEGREDO, AGORA)).toEqual(estadoValido());
  });

  it("TROCAR a organização no meio do caminho é recusado", () => {
    // O ataque concreto: alguém autoriza a própria conta de Instagram, edita a
    // organização no `state` e a conexão nasce no CRM de outra empresa — a
    // partir daí as mensagens dos clientes dela entram lá.
    const assinado = assinarEstado(estadoValido(), SEGREDO);
    const [corpo, assinatura] = assinado.split(".");

    const adulterado = JSON.stringify({
      ...estadoValido(),
      organizationId: "99999999-9999-4999-8999-999999999999",
    });
    const corpoFalso = Buffer.from(adulterado, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    expect(corpoFalso).not.toBe(corpo);
    expect(conferirEstado(`${corpoFalso}.${assinatura}`, SEGREDO, AGORA)).toBeNull();
  });

  it("assinado com OUTRO segredo não vale", () => {
    const deOutraInstalacao = assinarEstado(estadoValido(), "outro-segredo");
    expect(conferirEstado(deOutraInstalacao, SEGREDO, AGORA)).toBeNull();
  });

  it("vencido é recusado — a tela de consentimento não demora horas", () => {
    const assinado = assinarEstado(estadoValido(), SEGREDO);
    const muitoDepois = new Date(AGORA.getTime() + VALIDADE_DO_ESTADO_MS + 1000);
    expect(conferirEstado(assinado, SEGREDO, muitoDepois)).toBeNull();
  });

  it("lixo não derruba a rota — recusa em vez de estourar", () => {
    // Cada um destes já foi 500 em alguma implementação de OAuth: assinatura de
    // tamanho diferente faz `timingSafeEqual` LANÇAR, e base64 inválido faz o
    // `JSON.parse` estourar.
    for (const entrada of ["", "sem-ponto", "a.b", "a.b.c", "!!!.!!!", null]) {
      expect(() => conferirEstado(entrada, SEGREDO, AGORA)).not.toThrow();
      expect(conferirEstado(entrada, SEGREDO, AGORA)).toBeNull();
    }
  });

  it("sem segredo configurado, NADA passa (fail-closed)", () => {
    const assinado = assinarEstado(estadoValido(), SEGREDO);
    expect(conferirEstado(assinado, "", AGORA)).toBeNull();
  });
});

describe("a URL do consentimento", () => {
  it("leva o aplicativo, o retorno, o state e as permissões", () => {
    const u = new URL(
      montarUrlDeAutorizacao({
        appId: "123456",
        redirectUri: "https://crm.test/api/v1/channels/instagram/callback",
        state: "abc.def",
      }),
    );

    expect(u.searchParams.get("client_id")).toBe("123456");
    expect(u.searchParams.get("redirect_uri")).toBe(
      "https://crm.test/api/v1/channels/instagram/callback",
    );
    expect(u.searchParams.get("response_type")).toBe("code");
    expect(u.searchParams.get("state")).toBe("abc.def");

    const escopos = (u.searchParams.get("scope") ?? "").split(",");
    expect(escopos).toContain("instagram_business_basic");
    expect(escopos).toContain("instagram_business_manage_messages");
    // `human_agent` pedida sem aprovação faz a tela de consentimento INTEIRA
    // falhar — a pessoa não conecta nem o que já estava aprovado.
    expect(escopos).not.toContain("human_agent");
  });
});

describe("o código que a Meta devolve", () => {
  it("perde o sufixo `#_` que a Meta gruda nele", () => {
    // Dois caracteres a mais fazem a troca ser recusada com uma mensagem que
    // não menciona sufixo nenhum.
    expect(limparCodigo("AQBxyz#_")).toBe("AQBxyz");
    expect(limparCodigo("AQBxyz")).toBe("AQBxyz");
  });
});

describe("as trocas com a Meta", () => {
  let chamada: { url: string; init: RequestInit } | null = null;
  /**
   * `corpo` é o texto CRU, não um objeto — de propósito.
   *
   * Um dublê que devolvesse objeto JavaScript esconderia justamente o defeito
   * que importa aqui: o IGSID de 17 dígitos já chegaria arredondado, porque o
   * arredondamento acontece ao TRANSFORMAR texto em número. Servindo texto, o
   * teste exercita o mesmo caminho que a resposta real da Meta percorre.
   */
  let resposta: { ok: boolean; status: number; corpo: string };

  beforeEach(() => {
    chamada = null;
    resposta = { ok: true, status: 200, corpo: "{}" };
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      chamada = { url: String(url), init };
      return {
        ok: resposta.ok,
        status: resposta.status,
        text: async () => resposta.corpo,
        json: async () => JSON.parse(resposta.corpo),
      } as Response;
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("o código vai por FORMULÁRIO, não por JSON — este endpoint recusa JSON", async () => {
    resposta = { ok: true, status: 200, corpo: '{"access_token":"curto","user_id":178414}' };

    const r = await trocarCodigoPorTokenCurto({
      appId: "123",
      appSecret: "segredo",
      redirectUri: "https://crm.test/cb",
      code: "AQB#_",
    });

    expect(r.ok).toBe(true);
    const headers = chamada?.init.headers as Record<string, string>;
    expect(headers["content-type"]).toBe("application/x-www-form-urlencoded");
    const corpo = new URLSearchParams(String(chamada?.init.body));
    // O sufixo saiu antes de sair na rede.
    expect(corpo.get("code")).toBe("AQB");
    expect(corpo.get("grant_type")).toBe("authorization_code");
  });

  it("`expires_in` é lido em SEGUNDOS", async () => {
    resposta = {
      ok: true,
      status: 200,
      corpo: '{"access_token":"longo","expires_in":5184000}', // 60 dias
    };

    const r = await renovarTokenLongo({
      tokenLongo: "antigo",
      baseUrl: "https://graph.test",
      agora: AGORA,
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // 60 dias à frente, não 60 mil segundos nem 60 mil dias.
    const dias = (new Date(r.expiraEm!).getTime() - AGORA.getTime()) / 86_400_000;
    expect(Math.round(dias)).toBe(60);
  });

  it("a leitura da conta manda o token no HEADER, nunca na query", async () => {
    resposta = { ok: true, status: 200, corpo: '{"user_id":17841400000000001,"username":"loja"}' };

    const r = await contaDoToken({
      token: "TOKEN-SECRETO",
      baseUrl: "https://graph.test",
      graphVersion: "v25.0",
    });

    expect(r).toEqual({ ok: true, instagramUserId: "17841400000000001", username: "loja" });
    const headers = chamada?.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer TOKEN-SECRETO");
    expect(chamada?.url).not.toContain("TOKEN-SECRETO");
    expect(chamada?.url).not.toContain("access_token");
  });

  it("prefere `user_id` a `id` — `id` é de outro escopo e produz 404 no envio", async () => {
    resposta = { ok: true, status: 200, corpo: '{"id":"999","user_id":"17841400000000001"}' };

    const r = await contaDoToken({
      token: "t",
      baseUrl: "https://graph.test",
      graphVersion: "v25.0",
    });
    expect(r).toMatchObject({ instagramUserId: "17841400000000001" });
  });

  it("erro da Meta volta com o motivo dela, não com 'falhou'", async () => {
    resposta = {
      ok: false,
      status: 400,
      corpo: '{"error_message":"Invalid platform app"}',
    };

    const r = await trocarCodigoPorTokenCurto({
      appId: "123",
      appSecret: "errado",
      redirectUri: "https://crm.test/cb",
      code: "AQB",
    });
    expect(r).toEqual({ ok: false, motivo: "Invalid platform app" });
  });

  it("queda de rede NÃO lança — do outro lado há um navegador esperando", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("ECONNREFUSED");
    });

    const r = await renovarTokenLongo({
      tokenLongo: "t",
      baseUrl: "https://graph.test",
      agora: AGORA,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toContain("ECONNREFUSED");
  });
});
