import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/api/wrappers";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { ARCHIVED_AT, queryTolerantToMissingArchived } from "@/lib/channels/archived";
import { PROVIDER_DO_QR, STATUS_DE_PAREAMENTO_PENDENTE } from "@/lib/channels/pareamento-pendente";
import { CHANNEL_PROVIDER_WAHA } from "@/lib/channels/capabilities";
import {
  reactivateChannelSession,
  type ChannelReactivationActor,
} from "@/lib/channels/reactivate";
import { getWahaClient } from "@/lib/waha/client";
import { createClient } from "@/lib/supabase/server";

/**
 * Onboarding WhatsApp session orchestration.
 *
 * GET  → returns current session status (status enum from WAHA: STARTING|SCAN_QR_CODE|WORKING|FAILED|STOPPED)
 * POST → starts session if not already running. Idempotent.
 *
 * The actual QR image is served via /api/v1/onboarding/whatsapp/qr (proxy
 * to WAHA so client can <img src="..." /> without exposing the API key).
 */

interface WahaSessionResponse {
  name?: string;
  status?: string;
  config?: Record<string, unknown>;
  me?: { id?: string; pushName?: string };
}

function defaultSessionName(orgId: string): string {
  return `org_${orgId.slice(0, 8)}`;
}

/**
 * A linha de `channel_sessions` deste onboarding — criando, reutilizando ou
 * RESSUSCITANDO.
 *
 * O nome da sessão aqui é derivado do org (`org_<8>`), então a linha do
 * onboarding é sempre a MESMA. Quem excluiu o número e voltou para reconectar
 * cai exatamente nela, arquivada: devolvê-la como está subiria a sessão no
 * transporte e deixaria um canal que recebe e não entrega nada (webhook, ingest
 * e envio filtram `archived_at`) — e recusá-la fecharia o onboarding para sempre,
 * porque o nome nunca muda. Retomar o pareamento é ressuscitar.
 *
 * `phone_number` volta a NULL de propósito: o número só se sabe depois do
 * escaneamento, pode ser outro aparelho, e o health check só preenche o campo
 * quando ele está vazio — manter o antigo o congelaria errado na tela para
 * sempre. De quebra, a linha para de disputar o par (org, número) da trava da
 * 0106 enquanto ninguém escaneou.
 *
 * Retomar o pareamento é uma das duas portas de volta, então carrega o ATOR:
 * `reactivateChannelSession` audita a ressurreição, e sem quem pediu a trilha
 * mostraria um canal excluído voltando a entregar sem dono.
 */
/**
 * A sessão de WhatsApp que já está sendo pareada nesta organização, se houver.
 *
 * Existe porque DOIS caminhos desta rota entram no predicado do índice parcial
 * da migration 0204 — o INSERT de sessão nova e o UPDATE que ressuscita uma
 * arquivada (`reactivateChannelSession` grava `status='STARTING'` e
 * `phone_number=null`). Os dois podem levar `23505`, e num onboarding um erro
 * não tratado é 500 na PRIMEIRA tela do produto.
 *
 * Devolve o NOME junto do id, e isso é o ponto: a pendente foi criada pela tela
 * de Conexões, cujo nome leva sufixo aleatório e NUNCA é igual ao nome
 * determinístico do onboarding. Adotar só o id iniciaria no WAHA uma sessão sem
 * linha no banco, com a resposta apontando para outra — o webhook chegaria sem
 * dono e a mensagem recebida seria descartada em silêncio.
 */
/**
 * Como a conexão em andamento é NOMEADA para quem opera.
 *
 * `waha_session_name` (`org_<8>_<rand>`) é o identificador que a própria tela do
 * onboarding removeu por inacionável, e que a Central não exibe em canto nenhum
 * — dizê-lo ao operador é dar um código que ele não tem onde casar. O rótulo é
 * o `display_name`, que é o que ele vê na lista.
 */
function rotuloDe(sessao: { sessionName: string; displayName: string | null }): string {
  return sessao.displayName ?? "uma conexão ainda sem nome";
}

async function pareamentoEmAndamento(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
): Promise<{ id: string; sessionName: string; displayName: string | null } | null> {
  const { data, error } = await supabase
    .from("channel_sessions")
    .select("id, waha_session_name, display_name")
    // `provider` EXPLÍCITO e `archived_at` no filtro: o mesmo recorte do
    // predicado do índice. Concordar por coincidência com o default da coluna é
    // o que esta mudança inteira existe para não fazer.
    .eq("organization_id", orgId)
    .eq("provider", PROVIDER_DO_QR)
    .is(ARCHIVED_AT, null)
    .is("phone_number", null)
    .in("status", [...STATUS_DE_PAREAMENTO_PENDENTE])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`channel_session_pendente_lookup_failed: ${error.message}`);
  if (!data) return null;
  const linha = data as { id: string; waha_session_name: string; display_name: string | null };
  return { id: linha.id, sessionName: linha.waha_session_name, displayName: linha.display_name };
}

async function ensureChannelSession(
  orgId: string,
  sessionName: string,
  actor: ChannelReactivationActor,
): Promise<
  | { ok: true; id: string; sessionName: string }
  | { ok: false; emAndamento: string }
> {
  const supabase = await createClient();
  const buscar = (colunas: string) =>
    supabase
      .from("channel_sessions")
      .select(colunas)
      .eq("organization_id", orgId)
      .eq("waha_session_name", sessionName)
      .maybeSingle();
  const { data: existingRaw } = await queryTolerantToMissingArchived(
    () => buscar(`id, ${ARCHIVED_AT}`),
    () => buscar("id"),
  );
  const existing = existingRaw as { id: string; archived_at?: string | null } | null;
  if (existing?.id) {
    if (!existing.archived_at) return { ok: true, id: existing.id, sessionName };
    const { error: reErr } = await reactivateChannelSession(
      supabase,
      {
        organizationId: orgId,
        channelSessionId: existing.id,
        archivedAt: existing.archived_at ?? null,
      },
      {
        status: "STARTING",
        last_status_change_at: new Date().toISOString(),
        consecutive_health_fails: 0,
        phone_number: null,
      },
      actor,
    );
    // A ressurreição grava `STARTING` + `phone_number=null`, então ela TAMBÉM
    // entra no predicado do índice da 0204. Cenário real: a org conectou pelo
    // onboarding, excluiu o canal (arquivado), começou uma conexão nova pela
    // Central sem concluir, e voltou ao onboarding — aqui o UPDATE colide.
    //
    // Tratar só o ramo do INSERT deixava este devolvendo 500 no onboarding, que
    // é exatamente o desfecho que o outro ramo veio evitar.
    if (reErr?.code === "23505") {
      const emAndamento = await pareamentoEmAndamento(supabase, orgId);
      if (emAndamento) return { ok: false, emAndamento: rotuloDe(emAndamento) };
    }
    if (reErr) throw new Error(`channel_session_reactivate_failed: ${reErr.message}`);
    return { ok: true, id: existing.id, sessionName };
  }
  const { data: created, error } = await supabase
    .from("channel_sessions")
    .insert({
      organization_id: orgId,
      // EXPLÍCITO: o índice da 0204 tem `provider='waha'` no predicado, e
      // depender do default faria a trava e a linha concordarem por
      // coincidência. Mesmo argumento de `channel-sessions/route.ts`.
      provider: PROVIDER_DO_QR,
      waha_session_name: sessionName,
      engine: "NOWEB",
      webhook_path_token: crypto.randomUUID().replace(/-/g, ""),
      webhook_secret_encrypted: Buffer.from([0]),
      status: "STARTING",
      last_status_change_at: new Date().toISOString(),
      consecutive_health_fails: 0,
      daily_message_limit: 250,
      metadata: {},
    })
    .select("id")
    .single();
  if (error?.code === "23505") {
    const emAndamento = await pareamentoEmAndamento(supabase, orgId);
    if (emAndamento) return { ok: false, emAndamento: rotuloDe(emAndamento) };
    // Sumiu entre o conflito e a leitura (a outra requisição marcou FAILED).
    // Sem linha para adotar, o erro original é a resposta honesta.
  }
  if (error) throw new Error(`channel_session_insert_failed: ${error.message}`);
  return { ok: true, id: created.id as string, sessionName };
}

export async function GET() {
  const user = await loadAuthUser();
  if (!user) return fail("unauthenticated", "Sessão expirada", 401);
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) return fail("tenant_not_found", "Sem organização ativa", 404);
  const waha = getWahaClient();
  if (!waha) return ok({ status: "WAHA_NOT_CONFIGURED", session: null });
  const sessionName = defaultSessionName(activeOrg.orgId);
  try {
    const remote = (await waha.getSessionQr(sessionName)) as WahaSessionResponse;
    return ok({ status: remote.status ?? "UNKNOWN", session: sessionName });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    if (msg.includes("404")) return ok({ status: "NOT_STARTED", session: sessionName });
    return ok({ status: "ERROR", session: sessionName, error: msg });
  }
}

export async function POST(req: Request) {
  const requestId = randomUUID();
  const user = await loadAuthUser();
  if (!user) return fail("unauthenticated", "Sessão expirada", 401);
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) return fail("tenant_not_found", "Sem organização ativa", 404);
  const waha = getWahaClient();
  if (!waha) return fail("waha_not_configured", "Suba o Docker (docker compose up -d waha) e tente novamente.", 503);
  const sessionName = defaultSessionName(activeOrg.orgId);

  // 1) Make sure we have a row in channel_sessions.
  const sessao = await ensureChannelSession(activeOrg.orgId, sessionName, {
    userId: user.id,
    requestId,
    metadata: { provider: CHANNEL_PROVIDER_WAHA, origin: "onboarding" },
  });

  // Já há um pareamento em andamento, criado pela tela de Conexões. O onboarding
  // NÃO o adota, e a decisão é deliberada: adotar exigiria que o GET desta rota
  // e o proxy do QR seguissem o nome adotado, e os dois usam o nome
  // determinístico `org_<8>`. Meio-caminho seria o pior desfecho — o WAHA sobe
  // uma sessão, a tela mostra o QR de OUTRA, o aparelho pareia com uma sessão
  // sem linha no banco, e a mensagem que chegar é descartada em silêncio com o
  // wizard dizendo "Conectado!".
  //
  // 409 com o nome da conexão em andamento: quem opera resolve na Central e
  // volta. Honesto e acionável, em vez de 500 ou de um QR que não é o certo.
  if (!sessao.ok) {
    return fail(
      "conflict",
      `Já existe uma conexão de WhatsApp em andamento: ${sessao.emAndamento}. Conclua ou cancele em Conexões antes de continuar por aqui.`,
      409,
      { requestId },
    );
  }
  const { id: channelSessionId, sessionName: nomeEfetivo } = sessao;

  // 1b) `?restart=1` = pedido explícito de QR novo. O start sozinho não resolve
  // uma sessão FAILED: o WAHA responde 422 ("already exists") e o usuário fica
  // preso olhando um QR morto. O QR do WhatsApp expira em poucos minutos, então
  // "falhou, gere outro" é fluxo normal do onboarding, não caso de exceção.
  if (new URL(req.url).searchParams.get("restart") === "1") {
    try {
      await waha.stopSession(nomeEfetivo);
    } catch {
      // Sessão já parada/inexistente: seguir para o start é o comportamento certo.
    }
  }

  // 2) Start the session in WAHA. Idempotent — WAHA returns 422 if already started; treat as ok.
  try {
    const remote = (await waha.startSession(nomeEfetivo)) as WahaSessionResponse;
    // `requestId` também na resposta: é ele que liga o `X-Request-Id` que o
    // operador vê ao evento `channel.reactivated` que a ressurreição gravou.
    return ok(
      { status: remote.status ?? "STARTING", session: nomeEfetivo, channel_session_id: channelSessionId },
      { requestId },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    if (msg.includes("422") || msg.includes("409")) {
      // Session already exists — just fetch status.
      const remote = (await waha.getSessionQr(nomeEfetivo)) as WahaSessionResponse;
      return ok(
        { status: remote.status ?? "RUNNING", session: nomeEfetivo, channel_session_id: channelSessionId },
        { requestId },
      );
    }
    return NextResponse.json(
      { error: { code: "waha_start_failed", message: msg } },
      { status: 502 },
    );
  }
}
