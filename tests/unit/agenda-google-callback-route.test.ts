/**
 * A volta do consentimento do Google.
 *
 * Este arquivo é retorno de NAVEGADOR, e é isso que a maioria destes casos
 * prende: nenhum desfecho pode ser JSON nem 500. Quem clicou num botão e voltou
 * tem de ver a tela da Agenda dizendo o que houve — em português, sem citar
 * parceiro nenhum, e sem que a falha vire uma página em branco.
 *
 * O caso que mais importa não é nenhum erro: é a pessoa clicando "Cancelar" na
 * tela do Google. Isso não é falha, é alguém mudando de ideia — e tratá-lo como
 * erro enche o log e assusta quem não fez nada errado.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { audit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptWebhookSecret } from "@/lib/webhooks/secrets";
import { emitirEstado } from "@/lib/agenda/google/estado";

vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined), isServiceRoleConfigured: vi.fn(() => true) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/webhooks/secrets", () => ({ encryptWebhookSecret: vi.fn(async () => "\\xdeadbeef") }));

const ORG = "22222222-2222-4222-8222-222222222222";
const ANA = "11111111-1111-4111-8111-111111111111";
const SEGREDO = "um-segredo-de-instalacao-bem-comprido";

process.env.INTERNAL_SECRET = SEGREDO;
process.env.NEXT_PUBLIC_APP_URL = "https://crm.exemplo";
process.env.GOOGLE_CALENDAR_CLIENT_ID = "123.apps.googleusercontent.com";
process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "GOCSPX-segredo";

const ESCOPOS = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly";

function estadoValido(): string {
  return emitirEstado({ organizationId: ORG, userId: ANA }, { segredo: SEGREDO, agora: new Date() });
}

function pedido(query: Record<string, string>): NextRequest {
  const u = new URL("https://crm.exemplo/api/v1/agenda/google/callback");
  for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v);
  return new NextRequest(u);
}

/** O `upsert` fake, para inspecionar o que foi gravado. */
let upsertRecebido: Record<string, unknown> | null = null;
let opcoesDoUpsert: Record<string, unknown> | null = null;
let erroDoUpsert: { message: string } | null = null;

function respostaHttp(corpo: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as unknown as Response;
}

function googleRespondendoBem() {
  vi.mocked(fetch)
    .mockResolvedValueOnce(
      respostaHttp({ access_token: "ya29.novo", refresh_token: "1//r", expires_in: 3599, scope: ESCOPOS, token_type: "Bearer" }),
    )
    .mockResolvedValueOnce(respostaHttp({ id: "ana@clinica.com.br", timeZone: "America/Sao_Paulo" }));
}

beforeEach(() => {
  upsertRecebido = null;
  opcoesDoUpsert = null;
  erroDoUpsert = null;
  vi.stubGlobal("fetch", vi.fn());
  vi.mocked(encryptWebhookSecret).mockResolvedValue("\\xdeadbeef");
  vi.mocked(audit).mockClear();
  vi.mocked(createAdminClient).mockReturnValue({
    from: () => ({
      upsert: (linha: Record<string, unknown>, opcoes?: Record<string, unknown>) => {
        upsertRecebido = linha;
        opcoesDoUpsert = opcoes ?? null;
        return Promise.resolve({ error: erroDoUpsert });
      },
    }),
  } as unknown as ReturnType<typeof createAdminClient>);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function chamar(query: Record<string, string>) {
  const { GET } = await import("@/app/api/v1/agenda/google/callback/route");
  return GET(pedido(query));
}

const destino = (res: Response) => res.headers.get("location") ?? "";

describe("GET /api/v1/agenda/google/callback", () => {
  it("grava a conexão e volta dizendo que conectou", async () => {
    googleRespondendoBem();
    const res = await chamar({ code: "o-codigo", state: estadoValido() });

    expect(destino(res)).toBe("https://crm.exemplo/app/agenda?ok=agenda_conectada");
    expect(upsertRecebido).toMatchObject({
      organization_id: ORG,
      user_id: ANA,
      provider: "google_calendar",
      account_email: "ana@clinica.com.br",
      status: "healthy",
    });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "agenda.google.conexao_concluida" }));
  });

  it("a org e a pessoa vêm do state ASSINADO, nunca da query", async () => {
    // Service role bypassa RLS. Aceitar org da query aqui seria deixar qualquer
    // um gravar conexão na organização de outro.
    googleRespondendoBem();
    await chamar({
      code: "c",
      state: estadoValido(),
      organization_id: "99999999-9999-4999-8999-999999999999",
      user_id: "88888888-8888-4888-8888-888888888888",
    });
    expect(upsertRecebido).toMatchObject({ organization_id: ORG, user_id: ANA });
  });

  it("o token vai CIFRADO — nunca em claro", async () => {
    googleRespondendoBem();
    await chamar({ code: "c", state: estadoValido() });
    expect(encryptWebhookSecret).toHaveBeenCalledWith(expect.anything(), "ya29.novo");
    expect(encryptWebhookSecret).toHaveBeenCalledWith(expect.anything(), "1//r");
    expect(JSON.stringify(upsertRecebido)).not.toContain("ya29.novo");
    expect(JSON.stringify(upsertRecebido)).not.toContain("1//r");
  });

  // ─── O QUE A MINHA SABOTAGEM NÃO ALCANÇAVA ───────────────────────────────
  //
  // A verificação independente mediu que TRÊS quebras no upsert deixavam a
  // suíte inteira verde. Sabotagem que não alcança o mecanismo dá confiança
  // sobre uma proteção que não existe — é pior que sabotagem que falha, porque
  // falha é visível. Os três casos abaixo são exatamente essas três.

  it("o refresh_token CIFRADO chega à linha — sem ele a conexão morre em uma hora", async () => {
    // Esta é a mais cara das três, e é a que o commit da rota de ida argumenta
    // sem guardar: todo o raciocínio do `prompt=consent` existe para GARANTIR o
    // refresh_token, e nada vigiava o lado que o GRAVA. Quebrando a gravação, a
    // conexão nasce `healthy`, funciona uma hora e morre calada — o relato chega
    // como "minha agenda parou de sincronizar", no dia seguinte, longe daqui.
    googleRespondendoBem();
    vi.mocked(encryptWebhookSecret).mockImplementation(async (_admin, texto) =>
      texto === "1//r" ? "\\xREFRESH" : "\\xACCESS",
    );
    await chamar({ code: "c", state: estadoValido() });

    expect(upsertRecebido).toMatchObject({
      oauth_access_token_encrypted: "\\xACCESS",
      oauth_refresh_token_encrypted: "\\xREFRESH",
    });
    // Controle positivo DENTRO do mesmo objeto: se o `toMatchObject` deixasse de
    // ler o literal, esta linha cairia junto e a asserção acima não passaria por
    // vacuidade.
    expect(upsertRecebido?.account_email).toBe("ana@clinica.com.br");
  });

  it("o vencimento gravado é o que o Google disse, não um palpite", async () => {
    // `expires_in` é RELATIVO. Gravar um vencimento inventado faz o worker de
    // renovação renovar cedo demais (caro) ou tarde demais (401 no meio de um
    // agendamento) — e nenhum dos dois aparece como erro.
    vi.setSystemTime(new Date("2026-08-26T12:00:00.000Z"));
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        respostaHttp({ access_token: "ya29.novo", refresh_token: "1//r", expires_in: 3599, scope: ESCOPOS, token_type: "Bearer" }),
      )
      .mockResolvedValueOnce(respostaHttp({ id: "ana@clinica.com.br", timeZone: "America/Sao_Paulo" }));
    await chamar({ code: "c", state: estadoValido() });

    expect(upsertRecebido?.token_expires_at).toBe("2026-08-26T12:59:59.000Z");
    vi.useRealTimers();
  });

  it("a chave do upsert separa PESSOAS — duas agendas não viram uma", async () => {
    // `calendar_connections` é por pessoa. Se o `onConflict` esquecer `user_id`,
    // o segundo atendente que conectar SOBRESCREVE a conexão do primeiro: a
    // agenda de um passa a alimentar os horários do outro, e ninguém vê erro
    // nenhum — os dois continuam com uma linha "healthy".
    googleRespondendoBem();
    await chamar({ code: "c", state: estadoValido() });

    const chave = String(opcoesDoUpsert?.onConflict ?? "");
    for (const coluna of ["organization_id", "user_id", "provider", "account_email"]) {
      expect(chave.split(",").map((c) => c.trim())).toContain(coluna);
    }
  });

  it("quem clicou Cancelar volta sem erro no log — não é falha, é desistência", async () => {
    const res = await chamar({ error: "access_denied", state: estadoValido() });
    expect(destino(res)).toBe("https://crm.exemplo/app/agenda?erro=conexao_cancelada");
    expect(audit).not.toHaveBeenCalled();
  });

  it("state inválido dá UM motivo só — distinguir na URL ajudaria um atacante", async () => {
    const res = await chamar({ code: "c", state: "forjado.zzz" });
    expect(destino(res)).toBe("https://crm.exemplo/app/agenda?erro=retorno_nao_verificavel");
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "agenda.google.conexao_falhou" }),
    );
    expect(upsertRecebido).toBeNull();
  });

  it("escopo desmarcado NÃO vira conexão saudável", async () => {
    // A tela do Google deixa desmarcar escopo por escopo. Gravar assim faria a
    // conexão falhar só no primeiro agendamento, longe daqui, com uma mensagem
    // que culpa o calendário.
    vi.mocked(fetch).mockResolvedValueOnce(
      respostaHttp({
        access_token: "ya29.x",
        expires_in: 3599,
        scope: "https://www.googleapis.com/auth/calendar.readonly",
        token_type: "Bearer",
      }),
    );
    const res = await chamar({ code: "c", state: estadoValido() });
    expect(destino(res)).toBe("https://crm.exemplo/app/agenda?erro=permissao_incompleta");
    expect(upsertRecebido).toBeNull();
  });

  it("sem chave de cifra ativa, RECUSA — e a recusa não nomeia parceiro nenhum", async () => {
    googleRespondendoBem();
    vi.mocked(encryptWebhookSecret).mockResolvedValue(null);
    const res = await chamar({ code: "c", state: estadoValido() });
    expect(destino(res)).toBe("https://crm.exemplo/app/agenda?erro=cifra_indisponivel");
    expect(destino(res).toLowerCase()).not.toContain("nuvemshop");
    expect(upsertRecebido).toBeNull();
  });

  it("Google recusando a troca do código não vira 500", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(respostaHttp({ error: "invalid_grant" }, 400));
    const res = await chamar({ code: "usado-duas-vezes", state: estadoValido() });
    expect(res.status).toBe(307);
    expect(destino(res)).toBe("https://crm.exemplo/app/agenda?erro=troca_de_codigo_falhou");
  });

  it("falha ao gravar volta com motivo, em vez de dizer que conectou", async () => {
    googleRespondendoBem();
    erroDoUpsert = { message: "duplicate key" };
    const res = await chamar({ code: "c", state: estadoValido() });
    expect(destino(res)).toBe("https://crm.exemplo/app/agenda?erro=nao_consegui_guardar");
    expect(audit).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: "agenda.google.conexao_concluida" }),
    );
  });

  it("NENHUM desfecho é JSON e nenhum é 500", async () => {
    const casos: Array<Record<string, string>> = [
      { error: "access_denied", state: estadoValido() },
      { code: "c", state: "lixo" },
      { state: estadoValido() },
    ];
    for (const q of casos) {
      const res = await chamar(q);
      expect(res.status).toBe(307);
      expect(destino(res)).toContain("/app/agenda?");
    }
  });
});
