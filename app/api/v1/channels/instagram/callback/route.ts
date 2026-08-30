/**
 * GET /api/v1/channels/instagram/callback — a volta da Meta, com o código.
 *
 * ─── Por que esta rota NÃO chama `requireRole` ──────────────────────────────
 *
 * O cookie de sessão deste produto é `SameSite=Strict`. Numa navegação vinda de
 * outro site — que é exatamente o que a volta da Meta é — o navegador NÃO o
 * envia. Uma checagem de papel aqui reprovaria todo mundo, inclusive quem
 * acabou de autorizar corretamente, e o sintoma seria "conectei e voltei
 * deslogado".
 *
 * Quem autentica esta rota é o `state` ASSINADO que saiu de `/authorize` com o
 * papel já conferido. É ele que carrega a organização e a conexão, e é por isso
 * que ele é assinado em vez de apenas opaco: sem assinatura, trocar a
 * organização na barra de endereço gravaria a conta de Instagram de alguém no
 * CRM de outra empresa.
 *
 * ─── Por que sempre redireciona, e nunca devolve JSON ───────────────────────
 *
 * Do outro lado desta requisição há um navegador com uma pessoa olhando, não um
 * programa. Um JSON de erro aqui é uma página branca com chaves — a pessoa não
 * sabe se conectou, se falhou, nem o que fazer. Todo desfecho volta para a tela
 * de conexões dizendo o que aconteceu.
 *
 * ─── A troca tem que terminar aqui, no mesmo fluxo ──────────────────────────
 *
 * O token que o código vira dura UMA hora. Guardá-lo e "trocar pelo longo
 * depois" é uma conexão que morre antes do primeiro almoço. Por isso os três
 * passos — código → curto → longo — acontecem antes de qualquer escrita.
 */
import { NextResponse, type NextRequest } from "next/server";

import { ARCHIVED_AT, queryTolerantToMissingArchived } from "@/lib/channels/archived";
import { CHANNEL_PROVIDER_INSTAGRAM } from "@/lib/channels/capabilities";
import {
  instagramGraphBaseUrl,
  instagramGraphVersion,
} from "@/lib/channels/instagram/credentials";
import {
  conferirEstado,
  contaDoToken,
  trocarCodigoPorTokenCurto,
  trocarCurtoPorLongo,
} from "@/lib/channels/instagram/oauth";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptWebhookSecret, encryptWebhookSecret } from "@/lib/webhooks/secrets";
import { baseParaCallback, urlDaTelaDeConexoes, urlDeCallbackDoInstagram } from "../_base";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<Response> {
  const base = baseParaCallback(req);
  const voltar = (desfecho: string) =>
    NextResponse.redirect(urlDaTelaDeConexoes(base, desfecho), 302);

  const params = req.nextUrl.searchParams;

  // A pessoa clicou "cancelar" na tela da Meta, ou a Meta recusou. Não é falha
  // nossa e não merece registro de erro — merece a tela dizendo o que houve.
  if (params.get("error")) {
    return voltar("recusada");
  }

  const estado = conferirEstado(params.get("state"), env.INTERNAL_SECRET, new Date());
  if (!estado) {
    // Assinatura inválida ou prazo vencido, sem distinguir: a diferença só
    // interessaria a quem estivesse tentando forjar um.
    return voltar("estado_invalido");
  }

  const code = params.get("code");
  if (!code) return voltar("sem_codigo");

  const admin = createAdminClient();
  const consultar = () =>
    admin
      .from("channel_sessions")
      .select("id, instagram_app_id, webhook_secret_encrypted")
      .eq("id", estado.channelSessionId)
      // A organização vem do `state` ASSINADO, nunca da query. Os dois filtros
      // juntos são o que impede um `state` legítimo de uma organização de tocar
      // a conexão de outra.
      .eq("organization_id", estado.organizationId)
      .eq("provider", CHANNEL_PROVIDER_INSTAGRAM);

  const { data } = await queryTolerantToMissingArchived(
    () => consultar().is(ARCHIVED_AT, null).maybeSingle(),
    () => consultar().maybeSingle(),
  );

  const sessao = data as {
    id: string;
    instagram_app_id: string | null;
    webhook_secret_encrypted: unknown;
  } | null;

  if (!sessao?.instagram_app_id || !sessao.webhook_secret_encrypted) {
    return voltar("conexao_sumiu");
  }

  const appSecret = await decryptWebhookSecret(admin, sessao.webhook_secret_encrypted as string);
  if (!appSecret) {
    // A chave de cifra da instalação sumiu ou mudou. É problema de servidor, e
    // mandar a pessoa "tentar de novo" a faria repetir para sempre.
    return voltar("cifra_indisponivel");
  }

  const redirectUri = urlDeCallbackDoInstagram(base);
  const agora = new Date();

  const curto = await trocarCodigoPorTokenCurto({
    appId: sessao.instagram_app_id,
    appSecret,
    redirectUri,
    code,
  });
  if (!curto.ok) {
    // O motivo da Meta vai para o log estruturado, não para a URL: ele pode
    // conter detalhe do aplicativo, e a barra de endereço é lida por qualquer
    // um que olhe a tela por cima do ombro.
    logger.warn("[instagram.callback] troca do código falhou", {
      motivo: curto.motivo,
      channelSessionId: sessao.id,
    });
    return voltar("troca_falhou");
  }

  const longo = await trocarCurtoPorLongo({
    appSecret,
    tokenCurto: curto.token,
    baseUrl: instagramGraphBaseUrl(),
    agora,
  });
  if (!longo.ok) {
    logger.warn("[instagram.callback] troca para token longo falhou", {
      motivo: longo.motivo,
      channelSessionId: sessao.id,
    });
    return voltar("troca_falhou");
  }

  const conta = await contaDoToken({
    token: longo.token,
    baseUrl: instagramGraphBaseUrl(),
    graphVersion: instagramGraphVersion(),
  });
  if (!conta.ok) {
    logger.warn("[instagram.callback] leitura da conta falhou", {
      motivo: conta.motivo,
      channelSessionId: sessao.id,
    });
    return voltar("conta_ilegivel");
  }

  const tokenCifrado = await encryptWebhookSecret(admin, longo.token);
  if (!tokenCifrado) return voltar("cifra_indisponivel");

  const { error } = await admin
    .from("channel_sessions")
    .update({
      instagram_user_id: conta.instagramUserId,
      instagram_token_encrypted: tokenCifrado,
      instagram_token_expires_at: longo.expiraEm,
      status: "WORKING",
      status_reason: null,
      display_name: conta.username ? `@${conta.username}` : "Instagram",
    })
    .eq("id", sessao.id)
    .eq("organization_id", estado.organizationId);

  if (error) {
    // 23505 = o índice único global da 0203: esta conta de Instagram já está
    // conectada em alguma organização ATIVA. É um desfecho legítimo e precisa
    // ser nomeado — "erro ao salvar" faria o operador tentar de novo para
    // sempre, quando o que ele precisa é desconectá-la de onde está.
    if ((error as { code?: string }).code === "23505") return voltar("conta_ja_conectada");
    logger.error("[instagram.callback] gravação falhou", {
      erro: error.message,
      channelSessionId: sessao.id,
    });
    return voltar("gravacao_falhou");
  }

  return voltar("conectada");
}
