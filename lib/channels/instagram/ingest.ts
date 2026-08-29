/**
 * A mensagem do Instagram entrando no CRM.
 *
 * ─── O que muda em relação ao WhatsApp ──────────────────────────────────────
 *
 * Não há telefone. O caminho canônico do WhatsApp resolve o contato por número
 * — com variantes do nono dígito e tudo — e aqui isso não existe: a pessoa é
 * identificada pelo IGSID, que a CONTA que recebe emitiu. Por isso a resolução
 * passa por `channel_contact_identities`, e o contato nasce sem telefone.
 *
 * ─── A ordem importa, e não é estética ──────────────────────────────────────
 *
 * identidade → contato → conversa → mensagem → carimbo → efeitos.
 *
 * O CARIMBO é o que move `last_inbound_at`, e é ele que abre a janela de 24
 * horas: sem isso o agente seria vetado para responder a alguém que acabou de
 * escrever. Os EFEITOS (opt-out, lead, despacho do agente) vêm por último e por
 * uma função só — a mesma dos outros canais. Pular essa chamada faz o canal
 * receber e nunca responder: um megafone, medido em produção no canal oficial.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { aplicarEfeitosPosEntrada } from "../pos-entrada";
import { contatoPorIdentidade, gravarIdentidade } from "./identidade";
import type { EventoDeEntrada } from "./webhook";

/** O canal, no vocabulário de `conversations.channel` — não o do provider. */
export const CANAL_DA_CONVERSA = "instagram";

export interface EntradaDoInstagram {
  organizationId: string;
  channelSessionId: string;
  evento: EventoDeEntrada;
}

export type DesfechoDaEntrada =
  | { status: "ingested"; messageId: string }
  | { status: "duplicate" }
  | { status: "failed"; reason: string };

/**
 * Encontra ou cria o contato desta pessoa, nesta conta.
 *
 * O contato nasce SEM telefone e com nome provisório. Enriquecer o perfil exige
 * uma chamada à Meta que só funciona depois de a pessoa ter escrito — e fazê-la
 * aqui, dentro do caminho de entrada, atrasaria a gravação da mensagem por uma
 * rede que pode estar lenta. Fica para quem cuida de avatar e nome, que já roda
 * em cron para os outros canais.
 */
async function contatoDaPessoa(
  admin: SupabaseClient,
  entrada: EntradaDoInstagram,
): Promise<string> {
  const { organizationId, channelSessionId, evento } = entrada;

  const existente = await contatoPorIdentidade(admin, {
    organizationId,
    channelSessionId,
    providerUserId: evento.providerUserId,
  });
  if (existente) return existente;

  const { data, error } = await admin
    .from("contacts")
    .insert({
      organization_id: organizationId,
      // O IGSID no nome é provisório e DELIBERADO: um contato sem nome nenhum
      // some na lista, e o operador não consegue nem procurá-lo. Com o id ele ao
      // menos existe e é encontrável até o perfil chegar.
      display_name: `Instagram ${evento.providerUserId.slice(-6)}`,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`instagram_contact_create_failed: ${error?.message ?? "sem id"}`);
  }

  const contactId = (data as { id: string }).id;
  // A amarração é gravada JUNTO com a criação, não depois: se este passo
  // falhasse em silêncio, a próxima mensagem da mesma pessoa não encontraria o
  // contato e criaria outro — e a conversa se partiria em pedaços.
  await gravarIdentidade(admin, {
    organizationId,
    channelSessionId,
    contactId,
    providerUserId: evento.providerUserId,
  });

  return contactId;
}

/** Prévia curta para a lista de conversas. */
function previa(evento: EventoDeEntrada): string {
  if (evento.ehApagada) return "(mensagem apagada)";
  if (evento.texto) return evento.texto.slice(0, 120);
  if (evento.midias.length > 0) return `(${evento.midias[0]!.tipo})`;
  return "(sem conteúdo)";
}

export async function ingerirEntradaDoInstagram(
  admin: SupabaseClient,
  entrada: EntradaDoInstagram,
): Promise<DesfechoDaEntrada> {
  const { organizationId, channelSessionId, evento } = entrada;

  const contactId = await contatoDaPessoa(admin, entrada);

  const { data: conversationId, error: erroConversa } = await admin.rpc(
    "fn_upsert_conversation_do_canal" as never,
    {
      p_org: organizationId,
      p_contact: contactId,
      p_session: channelSessionId,
      // EXPLÍCITO. A função irmã fixa `whatsapp` no corpo, e uma conversa de
      // Instagram marcada como WhatsApp some de toda tela que filtra por canal —
      // sem erro nenhum, porque `whatsapp` é um valor válido.
      p_channel: CANAL_DA_CONVERSA,
    } as never,
  );
  if (erroConversa || !conversationId) {
    return { status: "failed", reason: `conversa: ${erroConversa?.message ?? "sem id"}` };
  }

  const primeira = evento.midias[0];
  const { data: inserida, error: erroInsert } = await admin
    .from("messages")
    .insert({
      organization_id: organizationId,
      conversation_id: conversationId as string,
      channel_session_id: channelSessionId,
      contact_id: contactId,
      // O ECO é mensagem NOSSA que voltou: pode ser a resposta que uma pessoa
      // deu pelo aplicativo do Instagram. Gravá-la como entrada faria o agente
      // responder à própria casa; descartá-la mostraria atendimento pela metade.
      direction: evento.ehEco ? "outbound" : "inbound",
      status: "delivered",
      type: primeira ? (["image", "audio", "video"].includes(primeira.tipo) ? primeira.tipo : "document") : "text",
      body: evento.ehApagada ? null : evento.texto,
      external_id: evento.externalId,
      sent_at: new Date(evento.timestamp).toISOString(),
      metadata: {
        ...(primeira ? { instagram_media_url: primeira.url, instagram_media_type: primeira.tipo } : {}),
        ...(evento.respostaA ? { in_reply_to_external_id: evento.respostaA } : {}),
        ...(evento.ehApagada ? { instagram_apagada: true } : {}),
      },
    })
    .select("id")
    .maybeSingle();

  if (erroInsert) {
    // 23505 = a Meta re-entregou. Ela reenvia por até 36 horas quando não recebe
    // 200, e a documentação dela diz com todas as letras que a deduplicação é
    // NOSSA. Não é erro: é o contrato funcionando.
    if (erroInsert.code === "23505") return { status: "duplicate" };
    return { status: "failed", reason: `mensagem: ${erroInsert.message}` };
  }

  const messageId = (inserida as { id: string } | null)?.id ?? "";

  // O carimbo move `last_inbound_at` — é ELE que abre a janela de 24h. Sem isso
  // o agente seria vetado para responder a quem acabou de escrever.
  await admin.rpc("fn_mark_conversation_message" as never, {
    p_conv: conversationId as string,
    p_direction: evento.ehEco ? "outbound" : "inbound",
    p_preview: previa(evento),
    p_at: new Date(evento.timestamp).toISOString(),
  } as never);

  // Eco não dispara agente: ele é a nossa própria voz, e despachar aqui faria o
  // robô responder a si mesmo em laço.
  if (!evento.ehEco) {
    await aplicarEfeitosPosEntrada(admin, {
      organizationId,
      contactId,
      conversationId: conversationId as string,
      messageId: messageId || null,
      channelSessionId,
      texto: evento.texto,
      // A Meta não manda nome no webhook de mensagem — o perfil vem de uma
      // chamada à parte, que só funciona depois de a pessoa ter escrito. `null`
      // é honesto: quem batiza o card resolve com o que tiver.
      nomeDoContato: null,
      origem: "instagram_webhook",
    });
  }

  return { status: "ingested", messageId };
}
