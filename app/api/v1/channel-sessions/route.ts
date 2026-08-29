/**
 * GET  /api/v1/channel-sessions — lista os canais WhatsApp da org (do DB).
 *   Acessível a qualquer membro (usado pelo seletor do inbox e pela sidebar).
 * POST /api/v1/channel-sessions — conecta um NOVO número (cria a sessão com
 *   nome único e inicia no WAHA). Admin only.
 *
 * organization_id resolvido da sessão (cookie) — nunca do body.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { audit } from "@/lib/audit";
import { ok, fail } from "@/lib/api/wrappers";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { requireRole } from "@/lib/auth/require-role";
import { ARCHIVED_AT, queryTolerantToMissingArchived } from "@/lib/channels/archived";
import { PROVIDER_DO_QR, STATUS_DE_PAREAMENTO_PENDENTE } from "@/lib/channels/pareamento-pendente";
import { createChannelSchema } from "@/lib/schemas/channels";
import { createClient } from "@/lib/supabase/server";
import { getWahaClient, wahaFriendlyError } from "@/lib/waha/client";

export const dynamic = "force-dynamic";

export const CHANNEL_COLUMNS =
  "id, waha_session_name, display_name, phone_number, status, status_reason, last_health_check_at, last_status_change_at, daily_message_limit, is_warmup_complete, created_at";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const user = await loadAuthUser();
  if (!user) return fail("unauthenticated", "Auth required.", 401, { requestId });
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) return fail("forbidden_tenant", "Nenhuma organização ativa.", 403, { requestId });

  const supabase = await createClient();
  const base = () =>
    supabase
      .from("channel_sessions")
      .select(CHANNEL_COLUMNS)
      .eq("organization_id", activeOrg.orgId);
  // Canais arquivados sobrevivem só como âncora das FKs RESTRICT
  // (conversations/messages). Para o usuário eles foram excluídos.
  //
  // Tolerante à coluna ausente porque esta é a PRIMEIRA tela de quem já tem
  // número ligado: num clone que subiu o código sem a migration 0106, o filtro
  // devolveria 42703 → 500 → "Nenhum número conectado ainda", convidando o
  // operador a parear de novo um número que já está no ar. Sem a coluna, nada
  // está arquivado, e a lista sem o filtro é a lista certa (ver lib/channels/archived).
  const { data, error, schemaOutdated } = await queryTolerantToMissingArchived(
    () => base().is(ARCHIVED_AT, null).order("created_at", { ascending: true }),
    () => base().order("created_at", { ascending: true }),
  );
  if (error) return fail("internal_error", error.message, 500, { requestId });

  return ok(data ?? [], {
    requestId,
    ...(schemaOutdated ? { meta: { schema_outdated: true } } : {}),
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("admin", {
    requestId,
    resource: "channel_sessions",
    allowPlatformAdmin: true,
  });
  if (!authz.ok) return authz.response;
  const { user, org: activeOrg } = authz;

  const waha = getWahaClient();
  if (!waha) {
    return fail(
      "waha_not_configured",
      "O WhatsApp (WAHA) não está configurado neste ambiente: faltam WAHA_API_BASE_URL e/ou WAHA_API_KEY. Configure-as e tente de novo.",
      503,
      { requestId },
    );
  }

  let raw: unknown = {};
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  const parsed = createChannelSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return fail("validation_failed", "Dados inválidos.", 422, {
      requestId,
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
    });
  }

  const supabase = await createClient();
  // Nome de sessão único por canal — o hardcode `org_<8>` era 1 número por org.
  const sessionName = `org_${activeOrg.orgId.slice(0, 8)}_${randomUUID().replace(/-/g, "").slice(0, 6)}`;

  const { data: created, error: insErr } = await supabase
    .from("channel_sessions")
    .insert({
      organization_id: activeOrg.orgId,
      // EXPLÍCITO, mesmo com default 'waha' na coluna: o índice da 0204 tem
      // `provider='waha'` no predicado, e depender do default faria a trava e a
      // linha concordarem por coincidência, não por construção.
      provider: PROVIDER_DO_QR,
      waha_session_name: sessionName,
      display_name: parsed.data.display_name ?? null,
      engine: "NOWEB",
      webhook_path_token: randomUUID().replace(/-/g, ""),
      webhook_secret_encrypted: Buffer.from([0]),
      status: "STARTING",
      last_status_change_at: new Date().toISOString(),
      consecutive_health_fails: 0,
      daily_message_limit: 250,
      metadata: {},
    })
    .select(CHANNEL_COLUMNS)
    .single();

  // ── 23505 = já existe um pareamento pendente nesta organização ─────────────
  //
  // A trava é o índice parcial da migration 0204, e ela existe porque UM clique
  // criava DUAS sessões: `lib/api/client.ts` RETENTA mutação (`:126`, `:151`,
  // `:188`) e esta rota chama o WAHA DEPOIS do insert — WAHA lento faz o cliente
  // abortar e retentar com a linha já gravada. Medido em produção: dois
  // `channel.connected` com `request_id` distintos, 489 ms apart.
  //
  // Insert-e-trata-conflito, e não consulta-antes-de-inserir: a segunda forma é
  // read-then-write, e duas requisições concorrentes leem "não existe" e as duas
  // inserem. O índice decide no Postgres, atomicamente.
  //
  // A resposta é 200 com a sessão que venceu — é o que a segunda chamada queria.
  // 200 e não 201: nada foi criado nesta requisição. E sem `audit`: a rodada não
  // teve efeito, e auditá-la encheria o log com a retentativa que a trava existe
  // para absorver.
  if (insErr?.code === "23505") {
    const { data: vencedora, error: buscaErr } = await supabase
      .from("channel_sessions")
      .select(CHANNEL_COLUMNS)
      .eq("organization_id", activeOrg.orgId)
      .eq("provider", PROVIDER_DO_QR)
      .is(ARCHIVED_AT, null)
      .is("phone_number", null)
      .in("status", [...STATUS_DE_PAREAMENTO_PENDENTE])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Erro de BANCO não é ausência. Sem esta separação, permissão negada ou
    // coluna faltando viravam 409 "tente de novo" — e quem tentasse de novo
    // receberia 409 para sempre, sem nunca saber o motivo real.
    if (buscaErr) {
      return fail("internal_error", buscaErr.message, 500, { requestId });
    }

    // A vencedora sumiu entre o conflito e esta leitura — só acontece se a outra
    // requisição falhou no WAHA e marcou FAILED no intervalo. Devolver 409 em vez
    // de inventar uma resposta: quem chamou tenta de novo e agora consegue criar.
    if (!vencedora) {
      return fail(
        "conflict",
        "Outra conexão estava em andamento e não completou. Tente novamente.",
        409,
        { requestId },
      );
    }
    return ok(vencedora, { requestId, status: 200 });
  }

  if (insErr || !created) {
    return fail("internal_error", insErr?.message ?? "channel_session_insert_failed", 500, { requestId });
  }

  try {
    await waha.startSession(sessionName);
  } catch (err) {
    // Sem WAHA no ar, o canal não pode ficar preso em STARTING.
    //
    // MARCA `FAILED`, não apaga — e a diferença é o defeito que o `delete`
    // criava junto com a trava acima. Uma retentativa que recebeu 200 com ESTA
    // linha fica consultando o id dela; se o `delete` a removesse, a tela do QR
    // consultaria um id inexistente e travaria em "Preparando…" para sempre.
    //
    // `FAILED` resolve os dois lados: a linha existe para quem a recebeu (a tela
    // mostra o erro em vez de girar), e sai do índice parcial da 0204 — que só
    // cobre STARTING/SCAN_QR_CODE —, então a próxima tentativa cria normalmente.
    const { error: compErr } = await supabase
      .from("channel_sessions")
      .update({
        status: "FAILED",
        status_reason: wahaFriendlyError(err),
        last_status_change_at: new Date().toISOString(),
      })
      .eq("organization_id", activeOrg.orgId)
      .eq("id", created.id);

    // A compensação FALHOU: a linha continua `STARTING`, segura o índice da
    // 0203, e toda tentativa seguinte recebe 200 apontando para ela enquanto o
    // WAHA estiver fora. Descartar este erro seria repetir o defeito que esta
    // própria mudança corrige — e ele some do log, que é o pior desfecho.
    //
    // Não dá para "consertar" aqui (o banco acabou de recusar um update), mas
    // dá para NÃO esconder: o erro sai no log com o id da linha travada, que é
    // o que alguém precisa para destravar.
    if (compErr) {
      console.error(
        "[channel-sessions] compensação falhou — linha presa em STARTING",
        { session_id: created.id, erro: compErr.message },
      );
    }
    return fail("waha_error", wahaFriendlyError(err), 502, { requestId });
  }

  void audit({
    action: "channel.connected",
    actorUserId: user.id,
    organizationId: activeOrg.orgId,
    resourceType: "channel_session",
    resourceId: created.id,
    requestId,
    metadata: { waha_session_name: sessionName },
  });

  return ok(created, { requestId, status: 201 });
}
