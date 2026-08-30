/**
 * Qual conexão atende a conta que RECEBEU a mensagem.
 *
 * ─── Por que o token da URL não basta ───────────────────────────────────────
 *
 * A URL de webhook é por conexão, mas a Meta não entrega por conexão: ela
 * entrega por APLICATIVO. Um aplicativo tem UMA callback URL cadastrada, e
 * todas as contas ligadas a ele mandam eventos para lá.
 *
 * Numa organização com duas contas de Instagram — dois perfis da mesma empresa,
 * que é o caso para o qual `channel_contact_identities` foi desenhada — as
 * mensagens das DUAS chegam na URL que o operador cadastrou, e o token resolve
 * sempre para a mesma conexão. Sem esta consulta, a mensagem da conta B era
 * gravada debaixo da conexão A.
 *
 * O estrago não é de arquivo mal-organizado. O IGSID é escopado à conta que o
 * emitiu: a identidade nasce amarrada à sessão errada e, quando alguém responde,
 * o adapter manda o IGSID da conta B pelo TOKEN da conta A. A resposta não chega
 * — ou pior, chega a outra pessoa, porque o mesmo número de id pertence a
 * alguém diferente em cada conta.
 *
 * ─── O recorte, e o que ele protege ─────────────────────────────────────────
 *
 * A busca é por `(organization_id, instagram_user_id)`. A organização vem do
 * token do webhook, que é fonte confiável; o `instagram_user_id` vem do CORPO,
 * que quem assinou o payload controla. Parece perigoso e não é: para forjar um
 * corpo é preciso o App Secret, e ele é de UM aplicativo, de UMA organização.
 * Quem tem o segredo já podia mandar mensagem para as próprias contas — o que o
 * filtro de organização impede é o pulo para o CRM de outra empresa.
 *
 * Conta desconhecida devolve `null`, e quem chama IGNORA o evento. Cair de volta
 * na conexão do token seria refazer o defeito com um passo a mais.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { ARCHIVED_AT, queryTolerantToMissingArchived } from "../archived";
import { CHANNEL_PROVIDER_INSTAGRAM } from "../capabilities";

export interface BuscaDaSessao {
  /** De fonte confiável: o token do webhook resolveu esta organização. */
  organizationId: string;
  /** Do corpo assinado: a conta que aparece como destinatária do evento. */
  instagramUserId: string;
}

/**
 * A conexão desta conta, ou `null` quando esta organização não a atende.
 *
 * **LANÇA quando a consulta falha.** `null` precisa significar "não é nossa", e
 * só isso — um erro de banco convertido em `null` faria o lote inteiro ser
 * descartado como se fosse de outra empresa, calado.
 */
export async function sessaoDaConta(
  admin: SupabaseClient,
  busca: BuscaDaSessao,
): Promise<{ id: string } | null> {
  const { organizationId, instagramUserId } = busca;
  if (!organizationId || !instagramUserId) return null;

  const base = () =>
    admin
      .from("channel_sessions")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("provider", CHANNEL_PROVIDER_INSTAGRAM)
      .eq("instagram_user_id", instagramUserId);

  // Mesmo recorte do índice único da 0203 (`archived_at is null`): fora dele a
  // trava do banco não alcança, e a busca deixaria de ser exata justo onde
  // ninguém a garante.
  const { data, error } = await queryTolerantToMissingArchived(
    () => base().is(ARCHIVED_AT, null).maybeSingle(),
    () => base().maybeSingle(),
  );

  if (error) {
    throw new Error(`instagram_sessao_da_conta_falhou: ${error.message}`);
  }

  return (data as { id: string } | null) ?? null;
}
