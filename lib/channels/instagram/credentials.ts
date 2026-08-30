/**
 * A credencial da conta de Instagram que atende ESTA organização.
 *
 * ─── O que difere dos outros canais ─────────────────────────────────────────
 *
 * Duas coisas, e as duas mudam o desenho:
 *
 * 1. **Não há fallback de ambiente.** WhatsApp e canal intermediado aceitam
 *    credencial no `.env` porque a instalação inteira fala por UM número. Aqui
 *    o aplicativo na Meta é do CLIENTE — cada organização traz o seu, aprovado
 *    no App Review dela. Uma variável de ambiente global mandaria a mensagem de
 *    uma empresa pela conta de outra, que é o desfecho sem volta. Por isso
 *    `resolveInstagramCreds` devolve `null` quando não há sessão, e nunca cai
 *    em `process.env`.
 *
 * 2. **A credencial VENCE.** `channel_sessions.instagram_token_expires_at`
 *    (migration 0203) existe porque o token de longa duração da Meta tem prazo.
 *    A data volta junto com a credencial — quem envia não decide nada com ela,
 *    mas quem avisa (`channel_credential_expiring`, já no CHECK da 0203)
 *    precisa dela sem uma segunda consulta.
 *
 * A cifra é a MESMA dos outros canais (`fn_encrypt_oauth`/`fn_decrypt_oauth`
 * via `lib/webhooks/secrets.ts`). Um terceiro caminho de cifra é um lugar a mais
 * para a chave vazar e um a menos que a rotação alcança.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { ARCHIVED_AT, queryTolerantToMissingArchived } from "../archived";
import { decryptWebhookSecret } from "@/lib/webhooks/secrets";

/**
 * Versão da Graph API.
 *
 * `v25.0` é a que a documentação de mensagens do Instagram usa e vence em
 * jul/2028. A primeira versão deste arquivo dizia `v21.0`, que está perto do
 * fim de vida — versão de API não é detalhe de configuração: quando ela morre,
 * TODA chamada passa a responder erro, e o canal cai inteiro sem ninguém ter
 * mudado nada.
 *
 * Sobrescrevível para o teste apontar para outro servidor.
 */
export function instagramGraphVersion(): string {
  return process.env.INSTAGRAM_GRAPH_VERSION ?? "v25.0";
}

export function instagramGraphBaseUrl(): string {
  return process.env.INSTAGRAM_GRAPH_BASE_URL ?? "https://graph.instagram.com";
}

export interface InstagramCredentials {
  /** `channel_sessions.instagram_user_id` — a CONTA, não o aplicativo. */
  instagramUserId: string;
  /** Token de longa duração, já decifrado. Nunca sai em log. */
  token: string;
  /** Quando vence. `null` = a sessão não registrou prazo. */
  expiresAt: string | null;
  baseUrl: string;
  graphVersion: string;
}

export interface InstagramCredsLookup {
  /** De fonte confiável: cookie, linha já escopada, token do webhook. */
  organizationId: string;
  /** O `sessionRef` deste canal. */
  instagramUserId: string;
}

/**
 * A credencial da sessão, ou `null` quando esta organização não tem esta conta
 * conectada.
 *
 * **LANÇA quando a consulta falha.** Descartar o `error` foi metade do defeito
 * da issue #236: a colisão devolvia `data: null` com `PGRST116`, e o `null`
 * mandava organizações diferentes para a mesma credencial de fallback. Aqui não
 * há fallback, mas o raciocínio vale igual — `null` tem de significar "não
 * conectada", e só isso.
 */
export async function instagramCredsForAccount(
  admin: SupabaseClient,
  lookup: InstagramCredsLookup,
): Promise<InstagramCredentials | null> {
  const { organizationId, instagramUserId } = lookup;
  if (!organizationId || !instagramUserId) return null;

  // `organization_id` à mão porque service role bypassa RLS, e
  // `archived_at is null` pelo MESMO recorte do índice único
  // `channel_sessions_instagram_user_id_ativo_unique` (0203): fora do recorte a
  // trava do banco não alcança, e a busca deixaria de ser exata justamente onde
  // ninguém a garante.
  const base = () =>
    admin
      .from("channel_sessions")
      .select("instagram_user_id, instagram_token_encrypted, instagram_token_expires_at")
      .eq("organization_id", organizationId)
      .eq("provider", "meta_instagram")
      .eq("instagram_user_id", instagramUserId);

  const { data, error } = await queryTolerantToMissingArchived(
    () => base().is(ARCHIVED_AT, null).maybeSingle(),
    () => base().maybeSingle(),
  );

  if (error) {
    throw new Error(`instagram_creds_lookup_failed: ${error.message}`);
  }

  const linha = data as {
    instagram_user_id: string;
    instagram_token_encrypted: string | null;
    instagram_token_expires_at: string | null;
  } | null;

  // Sessão existe mas sem token: o canal foi criado e a autorização não
  // concluiu. É "não conectada", não erro — a tela mostra o estado e o envio
  // recusa; um throw aqui derrubaria o cron de saúde junto.
  if (!linha?.instagram_token_encrypted) return null;

  const token = await decryptWebhookSecret(admin, linha.instagram_token_encrypted);
  if (!token) {
    // Decifra que falha é DIFERENTE de token ausente: a chave de cifra mudou ou
    // o dado está corrompido, e tratar como "não conectada" esconderia uma
    // instalação que precisa de intervenção.
    throw new Error("instagram_token_decrypt_failed");
  }

  return {
    instagramUserId: linha.instagram_user_id,
    token,
    expiresAt: linha.instagram_token_expires_at,
    baseUrl: instagramGraphBaseUrl(),
    graphVersion: instagramGraphVersion(),
  };
}
