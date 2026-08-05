/**
 * O caminho de VOLTA de um canal: reconectar é ressuscitar.
 *
 * ─── Por que isto é uma função, e não `archived_at: null` em cada handler ────
 * O arquivamento (migration 0100) fez `archived_at` virar a chave que decide se
 * o canal existe: o webhook descarta o que chega nele, o ingest não cria
 * conversa, os seletores não o oferecem e o envio recusa. Enquanto isso, os
 * caminhos que RELIGAM um canal — reconectar o oficial, retomar o pareamento
 * pelo onboarding — escreviam status, credencial e número e deixavam a linha
 * arquivada. O resultado é o pior estado possível: a tela diz "conectado" e o
 * canal está permanentemente invisível e mudo. Quem religa tem que desarquivar,
 * e desarquivar num lugar só é o que impede a próxima reconexão de esquecer.
 *
 * ─── Por que tolera a coluna ausente ────────────────────────────────────────
 * Um clone que subiu o código sem aplicar a 0100 não tem `archived_at`. Gravar a
 * coluna direto ali derrubaria a reconexão inteira (a tela do canal oficial
 * pararia de conectar), e por um motivo que nem existe naquele banco: sem a
 * coluna, nada está arquivado, então o patch sem ela é o patch exato. A
 * detecção é a mesma de `./archived` — estreita, pelo nome da coluna na
 * mensagem de erro.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { ARCHIVED_AT, queryTolerantToMissingArchived, type DbErrorLike } from "./archived";

/** O canal, sempre por (organização, id) — tenancy explícita mesmo sob o admin. */
export interface ChannelSessionTarget {
  organizationId: string;
  channelSessionId: string;
}

/**
 * Aplica `patch` ao canal e o traz de volta à vida no MESMO update.
 *
 * Um update só, e não "patch + desarquiva depois": entre os dois haveria uma
 * janela em que o canal está ativo com a credencial antiga (ou arquivado com a
 * nova), e é justamente aí que o webhook e o envio consultam.
 *
 * O chamador decide o resto do estado — status, credencial, número —, porque
 * "voltar" significa coisas diferentes num canal oficial (a credencial nova
 * chegou validada) e num canal pareado por QR (o número só se sabe depois do
 * escaneamento). O que NÃO é do chamador é lembrar de desarquivar.
 */
export async function reactivateChannelSession(
  db: SupabaseClient,
  target: ChannelSessionTarget,
  patch: Record<string, unknown>,
): Promise<{ error: DbErrorLike | null; schemaOutdated: boolean }> {
  const aplicar = (corpo: Record<string, unknown>) =>
    db
      .from("channel_sessions")
      .update(corpo)
      .eq("organization_id", target.organizationId)
      .eq("id", target.channelSessionId);

  const { error, schemaOutdated } = await queryTolerantToMissingArchived(
    () => aplicar({ ...patch, [ARCHIVED_AT]: null }),
    () => aplicar(patch),
  );
  return { error: error ?? null, schemaOutdated };
}
