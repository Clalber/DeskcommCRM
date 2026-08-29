/**
 * GET  /api/v1/channels/instagram — as contas conectadas e o que colar na Meta.
 * POST /api/v1/channels/instagram — guarda a credencial do aplicativo do cliente.
 *
 * ─── Por que a lista é uma LISTA ────────────────────────────────────────────
 *
 * O canal oficial tem uma conexão por organização; aqui não. A tabela
 * `channel_contact_identities` foi desenhada (migration 0203) justamente porque
 * uma organização pode atender por duas contas de Instagram, e a mesma pessoa
 * falando com as duas produz identificadores diferentes. Uma tela que só
 * mostrasse "a" conexão esconderia a segunda e faria o operador achar que a
 * conexão dele foi substituída.
 *
 * ─── Este POST não conecta nada, e isso é deliberado ────────────────────────
 *
 * Ele só guarda o aplicativo. Conectar exige que a PESSOA autorize na Meta, e
 * essa ida acontece no navegador dela — não há como fazê-la a partir daqui. O
 * fluxo real tem quatro tempos, e três deles são do operador:
 *
 *   1. guarda o aplicativo  (este POST)
 *   2. cola a URL de webhook no painel da Meta e a Meta a verifica (o GET do
 *      handshake responde)
 *   3. autoriza  (`/authorize` manda o navegador para a Meta)
 *   4. a Meta volta com o código  (`/callback` troca por token e grava a conta)
 *
 * Guardar o aplicativo ANTES de tudo não é burocracia: o passo 2 precisa da
 * `webhook_path_token`, que nasce com a linha. Sem linha não há URL para
 * cadastrar, e sem webhook cadastrado a Meta não entrega mensagem nenhuma.
 *
 * ─── O que NUNCA volta num GET ──────────────────────────────────────────────
 *
 * App Secret e verify token entram e não saem. A tela mostra que EXISTEM, nunca
 * quais são — devolvê-los para preencher o campo seria vazá-los a cada render,
 * e o precedente do canal oficial já é este.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { ARCHIVED_AT, queryTolerantToMissingArchived } from "@/lib/channels/archived";
import { CHANNEL_PROVIDER_INSTAGRAM } from "@/lib/channels/capabilities";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptWebhookSecret } from "@/lib/webhooks/secrets";
import { baseParaCallback, urlDeCallbackDoInstagram } from "./_base";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const guardarSchema = z.object({
  // A Meta emite ids numéricos longos; `min(5)` recusa o campo em branco sem
  // fingir que sabe o formato exato dela.
  app_id: z.string().trim().min(5).max(64),
  app_secret: z.string().trim().min(16).max(256),
  // Inventado pelo operador. O piso de 8 evita "1234" — este token é a única
  // prova de origem do handshake, que a Meta não assina.
  verify_token: z.string().trim().min(8).max(256),
  display_name: z.string().trim().min(1).max(80).optional(),
});

interface LinhaDeSessao {
  id: string;
  instagram_app_id: string | null;
  instagram_user_id: string | null;
  instagram_token_encrypted: string | null;
  instagram_token_expires_at: string | null;
  instagram_verify_token_encrypted: string | null;
  display_name: string | null;
  status: string;
  webhook_path_token: string;
}

const COLUNAS =
  "id, instagram_app_id, instagram_user_id, instagram_token_encrypted, " +
  "instagram_token_expires_at, instagram_verify_token_encrypted, display_name, " +
  "status, webhook_path_token";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const requestId = randomUUID();
  const authz = await requireRole("admin", { requestId, resource: "channels_instagram" });
  if (!authz.ok) return authz.response;
  const orgId = authz.org.orgId;

  const admin = createAdminClient();
  const consultar = () =>
    admin
      .from("channel_sessions")
      .select(COLUNAS)
      .eq("organization_id", orgId)
      .eq("provider", CHANNEL_PROVIDER_INSTAGRAM)
      .order("created_at", { ascending: true });

  const { data, error } = await queryTolerantToMissingArchived(
    () => consultar().is(ARCHIVED_AT, null),
    () => consultar(),
  );

  if (error) {
    return fail("internal_error", error.message ?? "leitura falhou", 500, { requestId });
  }

  const base = baseParaCallback(req);
  const linhas = (data ?? []) as unknown as LinhaDeSessao[];

  return ok({
    // A URL que a Meta precisa ter cadastrada como "Redirect URI" no aplicativo.
    // Sai daqui e não da tela porque a tela não sabe o domínio público desta
    // instalação — e um caractere de diferença faz a Meta recusar a autorização
    // com uma mensagem que não diz qual é a URL esperada.
    redirectUri: urlDeCallbackDoInstagram(base),
    contas: linhas.map((l) => ({
      id: l.id,
      appId: l.instagram_app_id,
      displayName: l.display_name,
      status: l.status,
      /** Autorizada = tem token E conta. Sem os dois, é conexão pela metade. */
      conectada: Boolean(l.instagram_token_encrypted && l.instagram_user_id),
      instagramUserId: l.instagram_user_id,
      tokenExpiraEm: l.instagram_token_expires_at,
      /** Existe, não qual é. */
      temVerifyToken: Boolean(l.instagram_verify_token_encrypted),
      webhook: {
        callbackUrl: `${base}/api/v1/webhooks/channel/${l.webhook_path_token}`,
        campos: ["messages", "messaging_postbacks"],
      },
    })),
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = randomUUID();
  const authz = await requireRole("admin", { requestId, resource: "channels_instagram" });
  if (!authz.ok) return authz.response;
  const orgId = authz.org.orgId;

  const parsed = guardarSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail(
      "invalid_request",
      "app_id, app_secret e verify_token são obrigatórios",
      422,
      { requestId },
    );
  }
  const { app_id, app_secret, verify_token, display_name } = parsed.data;

  const admin = createAdminClient();

  // Cifra ANTES de qualquer escrita. Sem a GUC configurada, gravar em claro
  // seria pior que recusar — e o operador precisa saber que falta configuração
  // de SERVIDOR, não de credencial dele.
  const segredoCifrado = await encryptWebhookSecret(admin, app_secret);
  const verifyCifrado = await encryptWebhookSecret(admin, verify_token);
  if (!segredoCifrado || !verifyCifrado) {
    return fail(
      "invalid_request",
      "cifra indisponível nesta instalação (GUC app.nuvemshop_oauth_key ausente) — nada foi gravado",
      422,
      { requestId },
    );
  }

  // Uma conexão PENDENTE por aplicativo (índice parcial da 0208). Salvar duas
  // vezes atualiza a mesma linha em vez de criar órfã — e uma conexão já
  // autorizada não é tocada: ela saiu do recorte, e reescrever a credencial dela
  // por baixo derrubaria um canal que está funcionando.
  const buscar = () =>
    admin
      .from("channel_sessions")
      .select(`id, ${ARCHIVED_AT}`)
      .eq("organization_id", orgId)
      .eq("provider", CHANNEL_PROVIDER_INSTAGRAM)
      .eq("instagram_app_id", app_id)
      .is("instagram_user_id", null);

  const { data: existenteRaw } = await queryTolerantToMissingArchived(
    () => buscar().is(ARCHIVED_AT, null).maybeSingle(),
    () =>
      admin
        .from("channel_sessions")
        .select("id")
        .eq("organization_id", orgId)
        .eq("provider", CHANNEL_PROVIDER_INSTAGRAM)
        .eq("instagram_app_id", app_id)
        .is("instagram_user_id", null)
        .maybeSingle(),
  );
  const existente = existenteRaw as { id: string } | null;

  const campos = {
    instagram_app_id: app_id,
    webhook_secret_encrypted: segredoCifrado,
    instagram_verify_token_encrypted: verifyCifrado,
    display_name: display_name ?? "Instagram",
  };

  const { data, error } = existente
    ? await admin
        .from("channel_sessions")
        .update(campos)
        .eq("id", existente.id)
        .eq("organization_id", orgId)
        .select("id, webhook_path_token")
        .single()
    : await admin
        .from("channel_sessions")
        .insert({
          organization_id: orgId,
          provider: CHANNEL_PROVIDER_INSTAGRAM,
          // Autorização ainda não aconteceu. `STARTING` é o mesmo estado que o
          // canal por QR usa entre criar a sessão e a pessoa ler o código — a
          // conexão existe e não atende ainda.
          status: "STARTING",
          status_reason: "aguardando autorização na Meta",
          ...campos,
        })
        .select("id, webhook_path_token")
        .single();

  if (error) {
    // 23505 = duas abas, ou o cliente HTTP retentando. A linha vencedora já está
    // lá com a credencial certa; devolvê-la é o desfecho honesto.
    if ((error as { code?: string }).code === "23505") {
      const { data: vencedora } = await admin
        .from("channel_sessions")
        .select("id, webhook_path_token")
        .eq("organization_id", orgId)
        .eq("provider", CHANNEL_PROVIDER_INSTAGRAM)
        .eq("instagram_app_id", app_id)
        .is("instagram_user_id", null)
        .maybeSingle();
      if (vencedora) {
        const base = baseParaCallback(req);
        return ok({
          id: (vencedora as { id: string }).id,
          webhookUrl: `${base}/api/v1/webhooks/channel/${(vencedora as { webhook_path_token: string }).webhook_path_token}`,
          redirectUri: urlDeCallbackDoInstagram(base),
        });
      }
    }
    return fail("internal_error", error.message ?? "gravação falhou", 500, { requestId });
  }

  const linha = data as unknown as { id: string; webhook_path_token: string };
  const base = baseParaCallback(req);

  return ok({
    id: linha.id,
    // As duas URLs que o operador precisa cadastrar do lado da Meta, devolvidas
    // no mesmo passo em que ele guarda a credencial: separá-las em outra tela
    // faria a metade das instalações parar aqui.
    webhookUrl: `${base}/api/v1/webhooks/channel/${linha.webhook_path_token}`,
    redirectUri: urlDeCallbackDoInstagram(base),
  });
}
