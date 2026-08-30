/**
 * GET /api/v1/channels/instagram/authorize?session=<id> — manda a pessoa à Meta.
 *
 * Não devolve JSON: devolve um 302. Quem consente é a PESSOA, no navegador dela,
 * numa tela que é da Meta — não há como fazer isso a partir do servidor, e por
 * isso o fluxo tem uma ida e uma volta em vez de uma chamada só.
 *
 * ─── O `state` é a única coisa nossa que sobrevive à viagem ─────────────────
 *
 * E ele volta pela URL, por um canal que a pessoa controla. Por isso vai
 * ASSINADO: sem assinatura, alguém edita a organização na barra de endereço e a
 * conta de Instagram dele é gravada na organização de outra pessoa — e a partir
 * daí as mensagens de uma empresa entram no CRM de outra.
 *
 * O `state` é também o que AUTENTICA a volta, e isso não é preguiça: o cookie de
 * sessão deste produto é `SameSite=Strict`, então ele NÃO é enviado numa
 * navegação que vem de outro site. A volta da Meta é exatamente isso. Uma
 * `requireRole` no callback reprovaria todo mundo, sempre — inclusive quem
 * acabou de autorizar corretamente.
 */
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { ARCHIVED_AT, queryTolerantToMissingArchived } from "@/lib/channels/archived";
import { CHANNEL_PROVIDER_INSTAGRAM } from "@/lib/channels/capabilities";
import {
  VALIDADE_DO_ESTADO_MS,
  assinarEstado,
  montarUrlDeAutorizacao,
} from "@/lib/channels/instagram/oauth";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { baseParaCallback, urlDeCallbackDoInstagram } from "../_base";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  // A IDA exige papel; é aqui que a autorização é conferida. A volta é
  // autenticada pelo `state` assinado que sai daqui.
  const authz = await requireRole("admin", { requestId, resource: "channels_instagram" });
  if (!authz.ok) return authz.response;
  const orgId = authz.org.orgId;

  const sessionId = req.nextUrl.searchParams.get("session");
  if (!sessionId) {
    return fail("invalid_request", "informe a conexão a autorizar", 422, { requestId });
  }

  const admin = createAdminClient();
  const consultar = () =>
    admin
      .from("channel_sessions")
      .select("id, instagram_app_id")
      .eq("id", sessionId)
      // `organization_id` à mão: o service role bypassa RLS, e sem este filtro
      // um id de conexão de OUTRA organização seria autorizado por esta.
      .eq("organization_id", orgId)
      .eq("provider", CHANNEL_PROVIDER_INSTAGRAM);

  const { data } = await queryTolerantToMissingArchived(
    () => consultar().is(ARCHIVED_AT, null).maybeSingle(),
    () => consultar().maybeSingle(),
  );

  const sessao = data as { id: string; instagram_app_id: string | null } | null;
  if (!sessao) {
    return fail("not_found", "conexão não encontrada", 404, { requestId });
  }
  if (!sessao.instagram_app_id) {
    return fail(
      "invalid_request",
      "esta conexão ainda não tem o aplicativo da Meta configurado",
      422,
      { requestId },
    );
  }

  const state = assinarEstado(
    {
      organizationId: orgId,
      channelSessionId: sessao.id,
      expiraEm: Date.now() + VALIDADE_DO_ESTADO_MS,
    },
    env.INTERNAL_SECRET,
  );

  const destino = montarUrlDeAutorizacao({
    appId: sessao.instagram_app_id,
    redirectUri: urlDeCallbackDoInstagram(baseParaCallback(req)),
    state,
  });

  // 302 e não 307: é uma navegação, e o método não precisa ser preservado.
  return NextResponse.redirect(destino, 302);
}
