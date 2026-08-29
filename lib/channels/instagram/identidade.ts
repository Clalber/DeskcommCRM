/**
 * Quem é a pessoa do outro lado, num canal que não tem telefone.
 *
 * ─── Por que esta camada existe ─────────────────────────────────────────────
 *
 * O WhatsApp endereça por número, e o número é da PESSOA: o mesmo `+55…` vale
 * para qualquer conta que fale com ela. O Instagram não. O identificador que
 * chega no webhook (IGSID) é emitido pela CONTA que recebe — a mesma pessoa
 * falando com duas contas da mesma organização tem DOIS ids, e ids de contas
 * diferentes não são comparáveis entre si.
 *
 * Daí a tabela `channel_contact_identities` (migration 0203) ser escopada à
 * SESSÃO e não ao contato. Guardar isso numa coluna do contato — o caminho
 * óbvio, e o errado — faria a resposta sair pela conta errada, que é o desfecho
 * que não tem volta: a mensagem chega a quem não devia.
 *
 * ─── O que este módulo NÃO faz ──────────────────────────────────────────────
 *
 * Não cria contato. Resolver identidade e criar pessoa são decisões diferentes:
 * a ingestão sabe o que fazer quando não encontra ninguém (criar), e o envio
 * sabe que não encontrar é motivo para NÃO enviar. Fundir as duas aqui faria o
 * caminho de saída criar contato como efeito colateral de tentar responder.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** O identificador que o provider dá à pessoa, nesta sessão. */
export interface IdentidadeExterna {
  contactId: string;
  providerUserId: string;
}

export interface BuscaDeIdentidade {
  /** Da sessão do cookie ou do token do webhook — NUNCA do corpo. */
  organizationId: string;
  channelSessionId: string;
}

/**
 * O contato desta sessão que atende por `providerUserId`, ou `null`.
 *
 * `organization_id` entra no filtro mesmo com `channel_session_id` já sendo
 * único: quem chama usa service role, que bypassa RLS, e a doutrina cobra o
 * filtro explícito em toda query de tabela multi-tenant. `canal-consulta-por-
 * organizacao.test.ts` reprova quem esquecer.
 */
export async function contatoPorIdentidade(
  admin: SupabaseClient,
  busca: BuscaDeIdentidade & { providerUserId: string },
): Promise<string | null> {
  const { data, error } = await admin
    .from("channel_contact_identities")
    .select("contact_id")
    .eq("organization_id", busca.organizationId)
    .eq("channel_session_id", busca.channelSessionId)
    .eq("provider_user_id", busca.providerUserId)
    .maybeSingle();

  // LANÇA em erro de query, e não devolve `null`: `null` aqui significa "esta
  // pessoa ainda não tem contato", e a ingestão responde criando um. Um erro de
  // banco disfarçado de `null` criaria um contato DUPLICADO a cada mensagem —
  // o histórico da conversa se partiria em pedaços sem ninguém perceber.
  if (error) {
    throw new Error(`channel_contact_identity_lookup_failed: ${error.message}`);
  }
  return (data as { contact_id: string } | null)?.contact_id ?? null;
}

/**
 * O identificador pelo qual ESTA sessão endereça este contato, ou `null`.
 *
 * O caminho inverso do de cima, e é o que o envio precisa: o CRM conhece o
 * contato; o Instagram só entende o IGSID daquela conta.
 */
export async function identidadePorContato(
  admin: SupabaseClient,
  busca: BuscaDeIdentidade & { contactId: string },
): Promise<string | null> {
  const { data, error } = await admin
    .from("channel_contact_identities")
    .select("provider_user_id")
    .eq("organization_id", busca.organizationId)
    .eq("channel_session_id", busca.channelSessionId)
    .eq("contact_id", busca.contactId)
    .maybeSingle();

  if (error) {
    throw new Error(`channel_contact_identity_lookup_failed: ${error.message}`);
  }
  return (data as { provider_user_id: string } | null)?.provider_user_id ?? null;
}

/**
 * Grava a amarração, tolerando a corrida.
 *
 * Duas mensagens da mesma pessoa chegando juntas disputam o mesmo par
 * `(sessão, provider_user_id)` — que a 0203 tornou único. `upsert` com
 * `ignoreDuplicates` deixa a segunda passar sem erro em vez de derrubar a
 * ingestão: perder a linha é perder a mensagem, e a amarração já está correta
 * de qualquer forma, porque foi a primeira que a escreveu.
 */
export async function gravarIdentidade(
  admin: SupabaseClient,
  busca: BuscaDeIdentidade & IdentidadeExterna,
): Promise<void> {
  const { error } = await admin.from("channel_contact_identities").upsert(
    {
      organization_id: busca.organizationId,
      channel_session_id: busca.channelSessionId,
      contact_id: busca.contactId,
      provider_user_id: busca.providerUserId,
    },
    { onConflict: "channel_session_id,provider_user_id", ignoreDuplicates: true },
  );

  if (error) {
    throw new Error(`channel_contact_identity_write_failed: ${error.message}`);
  }
}
